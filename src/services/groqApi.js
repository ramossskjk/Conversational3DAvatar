import { buildSystemPrompt, KIRA_ERROR_MESSAGE } from "../constants/persona";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function webSearch(query) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await res.json();
    const results = [];
    if (data.AbstractText) results.push(data.AbstractText);
    if (data.Answer)       results.push(data.Answer);
    data.RelatedTopics?.slice(0, 3).forEach(t => t.Text && results.push(t.Text));
    return results.length > 0
      ? results.join("\n\n")
      : "Não encontrei resultados diretos para essa busca.";
  } catch {
    return "Não consegui acessar a internet agora.";
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Busca informações atuais na internet. Use quando precisar de dados recentes, notícias, ou informações que podem ter mudado.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "O que pesquisar na internet, em português ou inglês" },
        },
        required: ["query"],
      },
    },
  },
];

// ── Monta system prompt com as 3 camadas de memória ──────────────────────────
function buildMemoryContext(facts = [], summary = "", importantEvents = []) {
  const parts = [];

  if (facts.length > 0) {
    parts.push(`📌 FATOS SOBRE O USUÁRIO:\n${facts.map(f => `• ${f}`).join("\n")}`);
  }

  if (summary) {
    parts.push(`💬 RESUMO DO RELACIONAMENTO:\n${summary}`);
  }

  if (importantEvents.length > 0) {
    parts.push(`⭐ MOMENTOS IMPORTANTES:\n${importantEvents.map(e => `• ${e}`).join("\n")}`);
  }

  return parts.length > 0 ? parts.join("\n\n") : "";
}

// ── sendMessage ───────────────────────────────────────────────────────────────
export async function sendMessage(messages, facts = [], summary = "", importantEvents = []) {
  const memoryContext = buildMemoryContext(facts, summary, importantEvents);

  // buildSystemPrompt recebe o contexto de memória para injetar no prompt base
  const systemPrompt = buildSystemPrompt(facts, summary, importantEvents, memoryContext);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      tools: TOOLS,
      tool_choice: "auto",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Groq error:", err);
    throw new Error(`API error: ${response.status}`);
  }

  const data    = await response.json();
  const message = data.choices?.[0]?.message;

  if (message?.tool_calls?.length > 0) {
    const toolCall = message.tool_calls[0];
    const args     = JSON.parse(toolCall.function.arguments);
    const result   = await webSearch(args.query);

    const secondResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(({ role, content }) => ({ role, content })),
          { role: "assistant", content: null, tool_calls: message.tool_calls },
          { role: "tool", tool_call_id: toolCall.id, content: result },
        ],
      }),
    });

    const secondData = await secondResponse.json();
    return secondData.choices?.[0]?.message?.content ?? KIRA_ERROR_MESSAGE;
  }

  return message?.content ?? KIRA_ERROR_MESSAGE;
}

// ── detectMood — analisa a resposta da Kira e retorna o mood ──────────────────
export async function detectMood(kiraReply) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 10,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `Você analisa o tom emocional de uma fala de personagem e retorna APENAS uma palavra do mood.
Opções disponíveis: happy, excited, embarrassed, confused, surprised, thinking, wink, idle
Regras:
- excited: animação, empolgação, comemorando algo
- embarrassed: timidez, elogio recebido, algo íntimo/pessoal
- confused: dúvida, não entendeu, algo contraditório
- surprised: algo inesperado, chocante ou incrível
- thinking: reflexão, análise, resposta técnica ou filosófica
- wink: piada, ironia, flerte leve, cumplicidade
- happy: padrão positivo e animado
- idle: neutro, sem emoção clara
Responda APENAS com a palavra, sem pontuação.`,
          },
          {
            role: "user",
            content: kiraReply.slice(0, 300), // usa só o início pra economizar tokens
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim().toLowerCase();

    const valid = ["happy","excited","embarrassed","confused","surprised","thinking","wink","idle"];
    return valid.includes(text) ? text : "happy";
  } catch {
    return "happy";
  }
}
export async function detectFact(userMessage) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 100,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `Você analisa mensagens e detecta fatos pessoais relevantes sobre o usuário.
Se houver um fato relevante (nome, idade, profissão, hobby, gosto, desgosto, localização, etc), responda APENAS com o fato em português resumido em até 10 palavras.
Se não houver nenhum fato relevante, responda exatamente: null`,
          },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text === "null") return null;
    return text;
  } catch {
    return null;
  }
}
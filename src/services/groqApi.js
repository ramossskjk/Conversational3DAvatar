import { buildSystemPrompt, KIRA_ERROR_MESSAGE } from "../constants/persona";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Monta contexto de memória ─────────────────────────────────────────────────
function buildMemoryContext(facts = [], summary = "", importantEvents = []) {
  const parts = [];
  if (facts.length > 0)
    parts.push(`📌 FATOS SOBRE O USUÁRIO:\n${facts.map(f => `• ${f}`).join("\n")}`);
  if (summary)
    parts.push(`💬 RESUMO DO RELACIONAMENTO:\n${summary}`);
  if (importantEvents.length > 0)
    parts.push(`⭐ MOMENTOS IMPORTANTES:\n${importantEvents.map(e => `• ${e}`).join("\n")}`);
  return parts.join("\n\n");
}

// ── sendMessage ───────────────────────────────────────────────────────────────
export async function sendMessage(
  messages,
  facts           = [],
  summary         = "",
  importantEvents = [],
  searchContext   = "",  // ← contexto da busca Tavily
) {
  const memoryContext = buildMemoryContext(facts, summary, importantEvents);
  const systemPrompt  = buildSystemPrompt(facts, summary, importantEvents, memoryContext);

  const systemMessages = [
    { role: "system", content: systemPrompt },
  ];

  if (searchContext) {
    systemMessages.push({
      role:    "system",
      content: `🌐 INFORMAÇÕES ATUAIS DA WEB (use para embasar sua resposta):\n${searchContext}`,
    });
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
    },
    body: JSON.stringify({
      model:      "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        ...systemMessages,
        ...messages.map(({ role, content }) => ({ role, content })),
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Groq error:", err);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? KIRA_ERROR_MESSAGE;
}

// ── detectMood ────────────────────────────────────────────────────────────────
export async function detectMood(kiraReply) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  10,
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
            role:    "user",
            content: kiraReply.slice(0, 300),
          },
        ],
      }),
    });

    const data  = await response.json();
    const text  = data.choices?.[0]?.message?.content?.trim().toLowerCase();
    const valid = ["happy","excited","embarrassed","confused","surprised","thinking","wink","idle"];
    return valid.includes(text) ? text : "happy";
  } catch {
    return "happy";
  }
}

// ── detectFact ────────────────────────────────────────────────────────────────
export async function detectFact(userMessage) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  100,
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
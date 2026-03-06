import fetch from "node-fetch";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

// ── Busca no Tavily ───────────────────────────────────────────────────────────

export async function tavilySearch(query, apiKey, maxResults = 5) {
  if (!apiKey) throw new Error("VITE_TAVILY_KEY não definida");

  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key:             apiKey,
      query,
      search_depth:        "basic",
      max_results:         maxResults,
      include_answer:      true,
      include_raw_content: false,
    }),
  });

  if (!res.ok) throw new Error(`Tavily error: ${res.status}`);

  const data = await res.json();

  return {
    answer:  data.answer ?? "",
    results: (data.results ?? []).map(r => ({
      title:   r.title,
      url:     r.url,
      snippet: r.content ?? "",
    })),
  };
}

// ── Decide se precisa buscar (via Groq) ──────────────────────────────────────

export async function shouldSearch(userMessage, groqKey) {
  if (!groqKey) return { search: false };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  100,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Você decide se a mensagem precisa de busca na web para ser respondida corretamente.
Responda APENAS com JSON puro, sem markdown:
{"search": true, "query": "termo de busca"} — se precisar buscar
{"search": false} — se não precisar

PRECISA de busca: notícias recentes, preços, eventos atuais, clima, resultados, "o que está acontecendo", lançamentos, quem ganhou.
NÃO precisa: conversa casual, perguntas pessoais, matemática, código, opiniões, coisas que não mudam.`,
          },
          { role: "user", content: userMessage },
        ],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '{"search":false}';
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.error("❌ Erro ao decidir busca:", err.message);
    return { search: false };
  }
}

// ── Formata resultado pra injetar no prompt ───────────────────────────────────

export function formatSearchResults({ answer, results }, query) {
  const parts = [];

  if (answer) parts.push(`Resposta direta: ${answer}`);

  if (results.length > 0) {
    const snippets = results
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nFonte: ${r.url}`)
      .join("\n\n");
    parts.push(snippets);
  }

  if (!parts.length) return "";

  return `\n\n=== RESULTADOS DA WEB para "${query}" ===\n${parts.join("\n\n")}\n=== FIM ===\n`;
}
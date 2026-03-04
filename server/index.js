import "dotenv/config";
import express    from "express";
import cors       from "cors";
import fs         from "fs";
import path       from "path";
import { fileURLToPath } from "url";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const app         = express();
const PORT        = 3001;
const MEMORY_FILE = path.join(__dirname, "memory.json");
const SUMMARIZE_THRESHOLD = 40; // ✅ limite de mensagens antes de sumarizar

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ── Helpers ──────────────────────────────────────────────────────────────────

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE))
      return { messages: [], facts: [], summary: "", createdAt: new Date().toISOString() };
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch {
    return { messages: [], facts: [], summary: "", createdAt: new Date().toISOString() };
  }
}

function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function extractFacts(messages) {
  const facts = [];
  const patterns = [
    { regex: /meu nome [eé] (.+)/i,              label: "nome do usuário" },
    { regex: /me chamo (.+)/i,                   label: "nome do usuário" },
    { regex: /trabalho (?:com|em|como) (.+)/i,   label: "trabalho" },
    { regex: /estudo (.+)/i,                     label: "estudo" },
    { regex: /gosto de (.+)/i,                   label: "gosto" },
    { regex: /odeio (.+)/i,                      label: "desgosto" },
    { regex: /tenho (\d+) anos/i,                label: "idade" },
    { regex: /moro em (.+)/i,                    label: "localização" },
  ];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    for (const { regex, label } of patterns) {
      const match = msg.content.match(regex);
      if (match) {
        const fact = `${label}: ${match[1].trim()}`;
        if (!facts.includes(fact)) facts.push(fact);
      }
    }
  }
  return facts;
}

// ✅ Sumariza mensagens usando Groq
async function summarizeWithGroq(messages) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        max_tokens: 512,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `Você extrai memórias essenciais de conversas para uma VTuber IA chamada Kira.
Retorne APENAS um JSON válido com:
- "facts": array de strings com fatos importantes sobre o usuário (nome, idade, gostos, trabalho, localização, etc)
- "summary": string de 2-3 frases descrevendo o relacionamento e contexto emocional entre Kira e o usuário
Sem explicações, sem markdown, apenas o JSON.`,
          },
          {
            role: "user",
            content: `Extraia as memórias essenciais:\n${
              messages
                .filter(m => m.role !== "system")
                .map(m => `${m.role}: ${m.content}`)
                .join("\n")
            }`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (err) {
    console.error("Erro ao sumarizar:", err.message);
    return { facts: [], summary: "" };
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/memory", (req, res) => {
  res.json(readMemory());
});

app.post("/memory", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages))
    return res.status(400).json({ error: "messages must be array" });

  const current    = readMemory();
  const regexFacts = extractFacts(messages);
  let allFacts     = [...new Set([...current.facts, ...regexFacts])];
  let summary      = current.summary ?? "";
  let finalMessages = messages;
  let summarized   = false;

  // ✅ Sumariza quando atinge o limite
  if (messages.length >= SUMMARIZE_THRESHOLD) {
    console.log(`🧠 Limite de ${SUMMARIZE_THRESHOLD} msgs atingido. Sumarizando...`);
    const aiMemory = await summarizeWithGroq(messages);

    if (aiMemory.facts?.length)  allFacts = [...new Set([...allFacts, ...aiMemory.facts])];
    if (aiMemory.summary)        summary  = aiMemory.summary;

    finalMessages = messages.slice(-10); // mantém só as 10 mais recentes
    summarized    = true;
    console.log(`✅ Resumo gerado. Fatos: ${allFacts.length}, msgs mantidas: ${finalMessages.length}`);
  }

  const updated = {
    ...current,
    messages:  finalMessages,
    facts:     allFacts,
    summary,
    updatedAt: new Date().toISOString(),
  };

  writeMemory(updated);
  res.json({ ok: true, messageCount: updated.messages.length, factCount: allFacts.length, summarized });
});

app.delete("/memory", (req, res) => {
  const current = readMemory();
  writeMemory({
    ...current,
    messages: [],            // limpa apenas o histórico de mensagens
    // mantém facts e summary como memória de longo prazo
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.get("/memory/facts", (req, res) => {
  const { facts } = readMemory();
  res.json({ facts });
});

app.get("/status", (req, res) => {
  const { messages, facts, summary, updatedAt } = readMemory();
  res.json({ ok: true, messageCount: messages.length, factCount: facts.length, hasSummary: !!summary, updatedAt });
});

app.listen(PORT, () => {
  console.log(`🧠 Kira Memory Server rodando em http://localhost:${PORT}`);
  console.log(`📁 Memória salva em: ${MEMORY_FILE}`);
});

// POST /memory/facts — salva um fato individual confirmado pelo usuário
app.post("/memory/facts", (req, res) => {
  const { fact } = req.body;
  if (!fact || typeof fact !== "string")
    return res.status(400).json({ error: "fact must be a string" });

  const current  = readMemory();
  const allFacts = [...new Set([...current.facts, fact])];
  writeMemory({ ...current, facts: allFacts, updatedAt: new Date().toISOString() });
  res.json({ ok: true, factCount: allFacts.length });
});



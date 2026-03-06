import fs    from "fs";
import path  from "path";
import fetch from "node-fetch";
import { app } from "electron";
import { fileURLToPath } from "url";

app.setName("Kira");

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const MEMORY_FILE     = path.join(__dirname, "../memory.json");
const RECENT_LIMIT    = 20;
const SUMMARIZE_EVERY = 10;
const MAX_EVENTS      = 20;

// ── Lock — evita sumarizações concorrentes ────────────────────────────────────
let isSummarizing = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyMemory() {
  return {
    facts:            [],
    summary:          "",
    importantEvents:  [],
    recentMessages:   [],
    lastSummarizedAt: 0,
    totalSaved:       0,
    createdAt:        new Date().toISOString(),
  };
}

export function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return emptyMemory();
    const data = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
    // Migração formato antigo (server/)
    if (data.messages && !data.recentMessages) {
      data.recentMessages   = data.messages;
      data.importantEvents  = data.importantEvents ?? [];
      data.lastSummarizedAt = 0;
      data.totalSaved       = data.messages.length;
      delete data.messages;
    }
    // Migração eventos string → objeto
    if (Array.isArray(data.importantEvents)) {
      data.importantEvents = data.importantEvents.map(e =>
        typeof e === "string" ? { text: e, expiresAt: null } : e
      );
    }
    return { ...emptyMemory(), ...data };
  } catch {
    return emptyMemory();
  }
}

export function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ── Limpeza automática de eventos expirados ───────────────────────────────────

export function purgeExpiredEvents() {
  const data = readMemory();
  const now  = Date.now();
  const before = data.importantEvents.length;

  data.importantEvents = data.importantEvents.filter(e => {
    if (!e.expiresAt) return true;
    return new Date(e.expiresAt).getTime() > now;
  });

  const removed = before - data.importantEvents.length;
  if (removed > 0) {
    console.log(`🗑️  ${removed} evento(s) expirado(s) removido(s)`);
    writeMemory({ ...data, updatedAt: new Date().toISOString() });
  }
  return { removed };
}

// ── Detecta data em texto de evento ──────────────────────────────────────────

function extractEventDate(text) {
  const now   = new Date();
  const lower = text.toLowerCase();

  if (/amanh[ãa]/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (/\bhoje\b/.test(lower)) {
    const d = new Date(now);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (/essa semana|esta semana/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + (7 - d.getDay()));
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (/pr[oó]xima semana/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 14);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  const diaMatch = lower.match(/dia\s+(\d{1,2})(?:\/(\d{1,2}))?/);
  if (diaMatch) {
    const d   = new Date(now);
    const day = parseInt(diaMatch[1]);
    const mon = diaMatch[2] ? parseInt(diaMatch[2]) - 1 : d.getMonth();
    d.setMonth(mon);
    d.setDate(day + 1);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  return null;
}

function extractFactsByRegex(messages) {
  const patterns = [
    { regex: /meu nome [eé] (.+)/i,            label: "nome do usuário" },
    { regex: /me chamo (.+)/i,                 label: "nome do usuário" },
    { regex: /trabalho (?:com|em|como) (.+)/i, label: "trabalho" },
    { regex: /estudo (.+)/i,                   label: "estudo" },
    { regex: /gosto de (.+)/i,                 label: "gosto" },
    { regex: /odeio (.+)/i,                    label: "desgosto" },
    { regex: /tenho (\d+) anos/i,              label: "idade" },
    { regex: /moro em (.+)/i,                  label: "localização" },
  ];
  const facts = [];
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

async function summarizeWithGroq(recentMessages, existingFacts, existingSummary, existingEvents, apiKey) {
  try {
    const eventsText = existingEvents.map(e => e.text ?? e);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  768,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `Você é o sistema de memória de Kira, uma VTuber IA.
Retorne APENAS um JSON válido com exatamente estas chaves:
- "facts": array de strings com fatos pessoais do usuário
- "summary": string de 2-4 frases sobre o relacionamento Kira/usuário. NUNCA vazia.
- "importantEvents": array de strings (máx ${MAX_EVENTS}) com momentos marcantes. Para eventos temporários inclua a data na string.
Sem markdown, apenas JSON puro.`,
          },
          {
            role: "user",
            content: `=== CONTEXTO ATUAL ===
Fatos: ${JSON.stringify(existingFacts)}
Resumo: "${existingSummary}"
Eventos: ${JSON.stringify(eventsText)}

=== CONVERSA RECENTE ===
${recentMessages
  .filter(m => m.role === "user" || m.role === "assistant")
  .map(m => `${m.role === "user" ? "Usuário" : "Kira"}: ${m.content}`)
  .join("\n")}`,
          },
        ],
      }),
    });

    const data   = await response.json();
    const text   = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const newEvents = (Array.isArray(parsed.importantEvents) ? parsed.importantEvents : eventsText)
      .map(e => {
        const str = typeof e === "string" ? e : e.text;
        return { text: str, expiresAt: extractEventDate(str) };
      });

    return {
      facts:           parsed.facts?.length           ? parsed.facts        : existingFacts,
      summary:         parsed.summary?.trim()?.length  ? parsed.summary      : existingSummary,
      importantEvents: newEvents,
    };
  } catch (err) {
    console.error("❌ Erro ao sumarizar:", err.message);
    return { facts: existingFacts, summary: existingSummary, importantEvents: existingEvents };
  }
}

// ── Aprende com resultados de busca ──────────────────────────────────────────

export async function learnFromSearch(searchResults, apiKey) {
  if (!apiKey || !searchResults) return;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  200,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `Analise os resultados de busca e extraia fatos objetivos úteis para memorizar.
Retorne APENAS JSON: {"facts": ["fato 1"]} ou {"facts": []} se não houver nada relevante.
Máximo 3 fatos por busca. Apenas fatos concretos, não opiniões.`,
          },
          { role: "user", content: searchResults },
        ],
      }),
    });

    const data   = await response.json();
    const text   = data.choices?.[0]?.message?.content ?? '{"facts":[]}';
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    if (parsed.facts?.length > 0) {
      const current  = readMemory();
      const allFacts = [...new Set([...current.facts, ...parsed.facts])];
      writeMemory({ ...current, facts: allFacts, updatedAt: new Date().toISOString() });
      console.log(`🧠 Aprendi ${parsed.facts.length} fato(s) da busca`);
    }
  } catch (err) {
    console.error("❌ Erro ao aprender da busca:", err.message);
  }
}

// ── API exportada ─────────────────────────────────────────────────────────────

export function getMemory() {
  const { facts, summary, importantEvents, recentMessages } = readMemory();
  return { facts, summary, importantEvents, recentMessages };
}

export async function saveMemory(messages, apiKey) {
  if (!Array.isArray(messages)) throw new Error("messages must be array");

  const current        = readMemory();
  const regexFacts     = extractFactsByRegex(messages);
  let allFacts         = [...new Set([...current.facts, ...regexFacts])];
  const recentMessages = messages.slice(-RECENT_LIMIT);
  const totalSaved     = current.totalSaved + Math.max(0, messages.length - current.recentMessages.length);
  const msgsSince      = totalSaved - current.lastSummarizedAt;

  let { summary, importantEvents } = current;
  let summarized       = false;
  let lastSummarizedAt = current.lastSummarizedAt;

  // ── Lock — só sumariza se não há sumarização em curso ────────────────────
  if (msgsSince >= SUMMARIZE_EVERY && !isSummarizing) {
    isSummarizing = true;
    try {
      console.log(`🧠 Sumarizando (${msgsSince} novas msgs)...`);
      const ai     = await summarizeWithGroq(recentMessages, allFacts, summary, importantEvents, apiKey);
      allFacts         = [...new Set(ai.facts)];
      summary          = ai.summary;
      importantEvents  = ai.importantEvents.slice(0, MAX_EVENTS);
      lastSummarizedAt = totalSaved;
      summarized       = true;
      console.log(`✅ Fatos: ${allFacts.length} | Eventos: ${importantEvents.length}`);
    } finally {
      isSummarizing = false; // libera o lock mesmo se der erro
    }
  }

  writeMemory({
    ...current,
    facts: allFacts, summary, importantEvents,
    recentMessages, lastSummarizedAt, totalSaved,
    updatedAt: new Date().toISOString(),
  });

  return {
    ok:           true,
    messageCount: recentMessages.length,
    factCount:    allFacts.length,
    eventCount:   importantEvents.length,
    summarized,
  };
}

export function clearMemory() {
  const current = readMemory();
  writeMemory({ ...current, recentMessages: [], updatedAt: new Date().toISOString() });
  return { ok: true };
}

export function addFact(fact) {
  const current  = readMemory();
  const allFacts = [...new Set([...current.facts, fact])];
  writeMemory({ ...current, facts: allFacts, updatedAt: new Date().toISOString() });
  return { ok: true, factCount: allFacts.length };
}

export function removeEvent(indexOrText) {
  const current = readMemory();
  if (typeof indexOrText === "number") {
    current.importantEvents.splice(indexOrText, 1);
  } else {
    current.importantEvents = current.importantEvents.filter(
      e => (e.text ?? e) !== indexOrText
    );
  }
  writeMemory({ ...current, updatedAt: new Date().toISOString() });
  return { ok: true, events: current.importantEvents };
}

export async function forceSummarize(apiKey) {
  const current = readMemory();
  const ai      = await summarizeWithGroq(
    current.recentMessages, current.facts,
    current.summary, current.importantEvents, apiKey
  );
  const updated = {
    ...current,
    facts:            [...new Set(ai.facts)],
    summary:          ai.summary,
    importantEvents:  ai.importantEvents.slice(0, MAX_EVENTS),
    lastSummarizedAt: current.totalSaved,
    updatedAt:        new Date().toISOString(),
  };
  writeMemory(updated);
  return { ok: true, factCount: updated.facts.length, eventCount: updated.importantEvents.length };
}

export function getStatus() {
  const {
    recentMessages, facts, summary, importantEvents,
    totalSaved, lastSummarizedAt, updatedAt,
  } = readMemory();
  return {
    ok:                   true,
    messageCount:         recentMessages.length,
    factCount:            facts.length,
    eventCount:           importantEvents.length,
    hasSummary:           !!summary,
    totalSaved,
    msgsSinceLastSummary: totalSaved - lastSummarizedAt,
    nextSummarizeIn:      SUMMARIZE_EVERY - ((totalSaved - lastSummarizedAt) % SUMMARIZE_EVERY),
    updatedAt,
    memoryFile:           MEMORY_FILE,
  };
}
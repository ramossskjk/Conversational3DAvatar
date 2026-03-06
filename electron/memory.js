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

// ── Estrutura de evento ───────────────────────────────────────────────────────
// { text: string, expiresAt: "YYYY-MM-DD" | null, createdAt: string }
// expiresAt: null = permanente (ex: "gosto de café")
// expiresAt: data = expira automaticamente após essa data

function emptyMemory() {
  return {
    facts:            [],
    summary:          "",
    importantEvents:  [],   // array de objetos { text, expiresAt, createdAt }
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

    // Migração: converte strings antigas para o novo formato de objeto
    if (data.importantEvents?.length > 0 && typeof data.importantEvents[0] === "string") {
      data.importantEvents = data.importantEvents.map(text => ({
        text,
        expiresAt:  null,
        createdAt:  new Date().toISOString(),
      }));
    }

    // Migração do formato antigo (server/)
    if (data.messages && !data.recentMessages) {
      data.recentMessages   = data.messages;
      data.importantEvents  = data.importantEvents ?? [];
      data.lastSummarizedAt = 0;
      data.totalSaved       = data.messages.length;
      delete data.messages;
    }

    return { ...emptyMemory(), ...data };
  } catch {
    return emptyMemory();
  }
}

export function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ── Remove eventos expirados automaticamente ──────────────────────────────────
export function purgeExpiredEvents() {
  const data    = readMemory();
  const today   = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const before  = data.importantEvents.length;

  data.importantEvents = data.importantEvents.filter(ev => {
    if (!ev.expiresAt) return true;           // permanente — mantém
    return ev.expiresAt >= today;             // mantém se ainda não expirou
  });

  const removed = before - data.importantEvents.length;
  if (removed > 0) {
    console.log(`🗑️  ${removed} evento(s) expirado(s) removido(s) automaticamente`);
    writeMemory({ ...data, updatedAt: new Date().toISOString() });
  }

  return { removed };
}

// ── Remove evento manualmente por índice ─────────────────────────────────────
export function removeEvent(index) {
  const data = readMemory();
  if (index < 0 || index >= data.importantEvents.length) {
    return { ok: false, error: "Índice inválido" };
  }
  const removed = data.importantEvents.splice(index, 1)[0];
  writeMemory({ ...data, updatedAt: new Date().toISOString() });
  return { ok: true, removed };
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
    // Serializa eventos para o prompt (usa só o texto)
    const eventsText = existingEvents.map(e =>
      typeof e === "string" ? e : `${e.text}${e.expiresAt ? ` (até ${e.expiresAt})` : ""}`
    );

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        max_tokens:  900,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `Você é o sistema de memória de Kira, uma VTuber IA.
Retorne APENAS um JSON válido com exatamente estas chaves:
- "facts": array de strings com fatos pessoais permanentes do usuário
- "summary": string de 2-4 frases sobre o relacionamento Kira/usuário. NUNCA vazia.
- "importantEvents": array de objetos com { "text": string, "expiresAt": "YYYY-MM-DD" ou null }
  - Use expiresAt com data real para eventos temporários (reuniões, compromissos, prazos)
  - Use expiresAt null para eventos permanentes (conquistas, marcos do relacionamento)
  - Máx ${MAX_EVENTS} eventos
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

    // Normaliza eventos retornados pelo Groq
    const normalizeEvents = (events) => {
      if (!Array.isArray(events)) return existingEvents;
      return events.map(e => {
        if (typeof e === "string") return { text: e, expiresAt: null, createdAt: new Date().toISOString() };
        return {
          text:      e.text      ?? "",
          expiresAt: e.expiresAt ?? null,
          createdAt: new Date().toISOString(),
        };
      });
    };

    return {
      facts:           parsed.facts?.length           ? parsed.facts           : existingFacts,
      summary:         parsed.summary?.trim()?.length ? parsed.summary         : existingSummary,
      importantEvents: normalizeEvents(parsed.importantEvents),
    };
  } catch (err) {
    console.error("❌ Erro ao sumarizar:", err.message);
    return { facts: existingFacts, summary: existingSummary, importantEvents: existingEvents };
  }
}

// ── Aprende com resultados de busca ──────────────────────────────────────────
export async function learnFromSearch(query, searchResults, apiKey) {
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
            content: `Você extrai fatos úteis e duradouros de resultados de busca.
Retorne APENAS um JSON: {"facts": ["fato 1", "fato 2"]} com até 3 fatos concisos e objetivos.
Se não houver fatos úteis para guardar, retorne {"facts": []}.
Ignore informações temporárias, preços ou notícias passageiras.
Sem markdown, apenas JSON puro.`,
          },
          {
            role: "user",
            content: `Query: "${query}"\n\nResultados:\n${searchResults}`,
          },
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

  if (msgsSince >= SUMMARIZE_EVERY) {
    console.log(`🧠 Sumarizando (${msgsSince} novas msgs)...`);
    const ai     = await summarizeWithGroq(recentMessages, allFacts, summary, importantEvents, apiKey);
    allFacts         = [...new Set(ai.facts)];
    summary          = ai.summary;
    importantEvents  = ai.importantEvents.slice(0, MAX_EVENTS);
    lastSummarizedAt = totalSaved;
    summarized       = true;
    console.log(`✅ Fatos: ${allFacts.length} | Eventos: ${importantEvents.length}`);
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
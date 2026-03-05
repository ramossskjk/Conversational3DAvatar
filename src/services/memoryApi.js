// Detecta se está rodando no Electron ou no browser puro
const isElectron = typeof window !== "undefined" && !!window.electronAPI;

// ── API unificada — funciona em ambos os ambientes ────────────────────────────

export async function loadMemory() {
  try {
    if (isElectron) {
      const data = await window.electronAPI.getMemory();
      return {
        recentMessages:  data.recentMessages  ?? [],
        facts:           data.facts           ?? [],
        summary:         data.summary         ?? "",
        importantEvents: data.importantEvents ?? [],
      };
    }
    // Fallback HTTP (dev sem Electron)
    const res  = await fetch("http://localhost:3001/memory");
    const data = await res.json();
    return {
      recentMessages:  data.recentMessages ?? data.messages ?? [],
      facts:           data.facts           ?? [],
      summary:         data.summary         ?? "",
      importantEvents: data.importantEvents ?? [],
    };
  } catch {
    console.warn("Memory unavailable — usando sessão local.");
    return { recentMessages: [], facts: [], summary: "", importantEvents: [] };
  }
}

export async function saveMemory(messages) {
  try {
    if (isElectron) {
      const data = await window.electronAPI.saveMemory(messages);
      if (data?.summarized) {
        console.info(`🧠 Sumarizado — fatos: ${data.factCount} | eventos: ${data.eventCount} | msgs: ${data.messageCount}`);
      }
      return data;
    }
    const res  = await fetch("http://localhost:3001/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    return await res.json();
  } catch {}
}

export async function clearMemory() {
  try {
    if (isElectron) return window.electronAPI.clearMemory();
    await fetch("http://localhost:3001/memory", { method: "DELETE" });
  } catch {}
}

export async function saveFact(fact) {
  try {
    if (isElectron) return window.electronAPI.addFact(fact);
    await fetch("http://localhost:3001/memory/facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    });
  } catch {}
}

export async function forceSummarize() {
  try {
    if (isElectron) return window.electronAPI.forceSummarize();
    const res = await fetch("http://localhost:3001/memory/summarize", { method: "POST" });
    return await res.json();
  } catch { return null; }
}

export async function checkServer() {
  try {
    if (isElectron) return window.electronAPI.getStatus();
    const res = await fetch("http://localhost:3001/status");
    return await res.json();
  } catch { return false; }
}
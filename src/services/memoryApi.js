const SERVER = "http://localhost:3001";

export async function loadMemory() {
  try {
    const res = await fetch(`${SERVER}/memory`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      messages: data.messages ?? [],
      facts:    data.facts    ?? [],
      summary:  data.summary  ?? "",
    };
  } catch {
    console.warn("Memory server offline — usando sessão local.");
    return { messages: [], facts: [], summary: "" };
  }
}

export async function saveMemory(messages) {
  try {
    const res = await fetch(`${SERVER}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.summarized) {
      console.info(`🧠 Memória sumarizada — fatos: ${data.factCount}, msgs mantidas: ${data.messageCount}`);
    }
    return data;
  } catch {}
}

export async function clearMemory() {
  try {
    await fetch(`${SERVER}/memory`, { method: "DELETE" });
  } catch {}
}

export async function loadFacts() {
  try {
    const res = await fetch(`${SERVER}/memory/facts`);
    if (!res.ok) throw new Error();
    const { facts } = await res.json();
    return facts;
  } catch {
    return [];
  }
}

export async function checkServer() {
  try {
    const res = await fetch(`${SERVER}/status`);
    if (!res.ok) return false;
    return await res.json();
  } catch {
    return false;
  }
}

export async function saveFact(fact) {
  try {
    await fetch(`${SERVER}/memory/facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    });
  } catch {}
}
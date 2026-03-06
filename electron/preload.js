const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Memória ───────────────────────────────────────────────────────────────
  getMemory:      ()        => ipcRenderer.invoke("memory:get"),
  saveMemory:     (msgs)    => ipcRenderer.invoke("memory:save",        msgs),
  clearMemory:    ()        => ipcRenderer.invoke("memory:clear"),
  addFact:        (fact)    => ipcRenderer.invoke("memory:addFact",     fact),
  forceSummarize: ()        => ipcRenderer.invoke("memory:summarize"),
  getStatus:      ()        => ipcRenderer.invoke("memory:status"),
  removeEvent:    (index)   => ipcRenderer.invoke("memory:removeEvent", index),
  purgeEvents:    ()        => ipcRenderer.invoke("memory:purgeEvents"),

  // ── Busca ─────────────────────────────────────────────────────────────────
  searchShould:   (msg)     => ipcRenderer.invoke("search:should", msg),
  searchRun:      (query)   => ipcRenderer.invoke("search:run",    query),
});
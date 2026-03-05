import { contextBridge, ipcRenderer } from "electron";

// Expõe API segura pro renderer — sem acesso direto ao Node
contextBridge.exposeInMainWorld("electronAPI", {
  // Memória
  getMemory:      ()       => ipcRenderer.invoke("memory:get"),
  saveMemory:     (msgs)   => ipcRenderer.invoke("memory:save",    msgs),
  clearMemory:    ()       => ipcRenderer.invoke("memory:clear"),
  addFact:        (fact)   => ipcRenderer.invoke("memory:addFact", fact),
  forceSummarize: ()       => ipcRenderer.invoke("memory:summarize"),
  getStatus:      ()       => ipcRenderer.invoke("memory:status"),
});
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path    from "path";
import { fileURLToPath } from "url";
import * as memory from "./memory.js";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const GROQ_KEY   = process.env.GROQ_API_KEY;

// ── Janela principal ──────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,   // segurança — renderer não acessa Node diretamente
      nodeIntegration:  false,
    },
    backgroundColor: "#0d0118",
    show: false, // espera ready-to-show pra evitar flash branco
  });

  // Dev: carrega Vite dev server | Prod: carrega build
  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.once("ready-to-show", () => win.show());

  // Links externos abrem no browser do sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC Handlers — memória ────────────────────────────────────────────────────

ipcMain.handle("memory:get",      ()           => memory.getMemory());
ipcMain.handle("memory:save",     (_, msgs)    => memory.saveMemory(msgs, GROQ_KEY));
ipcMain.handle("memory:clear",    ()           => memory.clearMemory());
ipcMain.handle("memory:addFact",  (_, fact)    => memory.addFact(fact));
ipcMain.handle("memory:summarize",()           => memory.forceSummarize(GROQ_KEY));
ipcMain.handle("memory:status",   ()           => memory.getStatus());
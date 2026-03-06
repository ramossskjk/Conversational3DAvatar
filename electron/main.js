import { fileURLToPath }                        from "url";
import path                                     from "path";
import fs                                       from "fs";
import { app, BrowserWindow, ipcMain, shell }  from "electron";
import * as memory                              from "./memory.js";
import { tavilySearch, shouldSearch, formatSearchResults } from "./search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Lê o .env manualmente — contorna BOM e encoding do Windows ───────────────
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const raw     = fs.readFileSync(envPath);
  const content = raw[0] === 0xFF && raw[1] === 0xFE
    ? raw.toString("utf16le")
    : raw.toString("utf-8");

  content.split("\n").forEach(line => {
    const clean = line.trim().replace(/^\uFEFF/, "");
    if (!clean || clean.startsWith("#")) return;
    const idx = clean.indexOf("=");
    if (idx === -1) return;
    const key = clean.slice(0, idx).trim();
    const val = clean.slice(idx + 1).trim();
    if (key) process.env[key] = val;
  });
}

const isDev      = !app.isPackaged;
const GROQ_KEY   = process.env.VITE_GROQ_KEY;
const TAVILY_KEY = process.env.VITE_TAVILY_KEY;

console.log("🔑 GROQ_KEY:",   GROQ_KEY   ? "OK ✅" : "UNDEFINED ❌");
console.log("🔑 TAVILY_KEY:", TAVILY_KEY ? "OK ✅" : "UNDEFINED ❌");

// ── Remove eventos expirados ao iniciar ───────────────────────────────────────
memory.purgeExpiredEvents();

// ── Janela principal ──────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width:     1280,
    height:    800,
    minWidth:  900,
    minHeight: 600,
    frame:     true,
    webPreferences: {
      preload:          path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    backgroundColor: "#0d0118",
    show: false,
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.once("ready-to-show", () => win.show());

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

ipcMain.handle("memory:get",         ()         => memory.getMemory());
ipcMain.handle("memory:save",        (_, msgs)  => memory.saveMemory(msgs, GROQ_KEY));
ipcMain.handle("memory:clear",       ()         => memory.clearMemory());
ipcMain.handle("memory:addFact",     (_, fact)  => memory.addFact(fact));
ipcMain.handle("memory:summarize",   ()         => memory.forceSummarize(GROQ_KEY));
ipcMain.handle("memory:status",      ()         => memory.getStatus());
ipcMain.handle("memory:removeEvent", (_, index) => memory.removeEvent(index));
ipcMain.handle("memory:purgeEvents", ()         => memory.purgeExpiredEvents());

// ── IPC Handlers — busca ──────────────────────────────────────────────────────

ipcMain.handle("search:should", async (_, userMessage) => {
  return await shouldSearch(userMessage, GROQ_KEY);
});

ipcMain.handle("search:run", async (_, query) => {
  try {
    console.log(`🔍 Buscando: "${query}"`);
    const data      = await tavilySearch(query, TAVILY_KEY);
    const formatted = formatSearchResults(data, query);
    console.log(`✅ Busca concluída — ${data.results.length} resultados`);

    // Aprende com os resultados em background — não bloqueia a resposta
    memory.learnFromSearch(query, formatted, GROQ_KEY).catch(() => {});

    return { ok: true, ...data, formatted };
  } catch (err) {
    console.error("❌ Erro na busca:", err.message);
    return { ok: false, answer: "", results: [], formatted: "" };
  }
});
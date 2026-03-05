import express    from "express";
import cors       from "cors";
import fs         from "fs";
import path       from "path";
import { exec }  from "child_process";
import { promisify } from "util";
import multer    from "multer";
import fetch     from "node-fetch";
import FormData  from "form-data";
import { fileURLToPath } from "url";

const execAsync  = promisify(exec);
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const PORT       = 3001;
const MEMORY_FILE = path.join(__dirname, "memory.json");
const TMP_DIR    = path.join(__dirname, "tmp");

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

const upload = multer({ dest: TMP_DIR });

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174"] }));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────
function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return { messages: [], facts: [], createdAt: new Date().toISOString() };
    return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
  } catch { return { messages: [], facts: [], createdAt: new Date().toISOString() }; }
}
function writeMemory(data) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf-8");
}
function extractFacts(messages) {
  const facts = [];
  const patterns = [
    { regex: /meu nome [eé] (.+)/i, label: "nome do usuário" },
    { regex: /me chamo (.+)/i, label: "nome do usuário" },
    { regex: /trabalho (?:com|em|como) (.+)/i, label: "trabalho" },
    { regex: /estudo (.+)/i, label: "estudo" },
    { regex: /gosto de (.+)/i, label: "gosto" },
    { regex: /odeio (.+)/i, label: "desgosto" },
    { regex: /tenho (\d+) anos/i, label: "idade" },
    { regex: /moro em (.+)/i, label: "localização" },
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

// ── Memory routes ─────────────────────────────────────────────────────────────
app.get("/memory",        (req, res) => res.json(readMemory()));
app.get("/memory/facts",  (req, res) => res.json({ facts: readMemory().facts }));
app.get("/status",        (req, res) => {
  const { messages, facts, updatedAt } = readMemory();
  res.json({ ok: true, messageCount: messages.length, factCount: facts.length, updatedAt });
});
app.post("/memory", (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be array" });
  const current  = readMemory();
  const allFacts = [...new Set([...current.facts, ...extractFacts(messages)])];
  writeMemory({ ...current, messages: messages.slice(-100), facts: allFacts, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});
app.delete("/memory", (req, res) => {
  writeMemory({ messages: [], facts: [], createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

// ── Code routes ───────────────────────────────────────────────────────────────
const CODE_EXT = [".js",".jsx",".ts",".tsx",".py",".java",".cs",".cpp",".c",".html",".css",".json",".md",".vue",".svelte",".go",".rs",".php",".rb",".kt",".swift",".yaml",".yml",".sh"];
app.post("/read-file", (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: "filePath required" });
  if (!CODE_EXT.includes(path.extname(filePath).toLowerCase())) return res.status(403).json({ error: "Extensão não permitida" });
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines   = content.split("\n").length;
    res.json({ ok: true, filePath, ext: path.extname(filePath), lines, size: Buffer.byteLength(content), content: content.split("\n").slice(0, 500).join("\n"), truncated: lines > 500 });
  } catch { res.status(404).json({ error: `Arquivo não encontrado: ${filePath}` }); }
});
app.post("/list-files", (req, res) => {
  const { dirPath, depth = 2 } = req.body;
  if (!dirPath) return res.status(400).json({ error: "dirPath required" });
  try {
    const walk = (dir, d) => {
      if (d > depth) return [];
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        if (e.name.startsWith(".") || e.name === "node_modules") return [];
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return [{ type:"dir", name:e.name, path:full }, ...walk(full, d+1)];
        const ext = path.extname(e.name).toLowerCase();
        return CODE_EXT.includes(ext) ? [{ type:"file", name:e.name, path:full, ext }] : [];
      });
    };
    res.json({ ok: true, dirPath, files: walk(dirPath, 1) });
  } catch { res.status(404).json({ error: `Pasta não encontrada: ${dirPath}` }); }
});

// ── Audio pipeline ────────────────────────────────────────────────────────────
// POST /audio/transcribe — recebe áudio, converte com ffmpeg, transcreve com Whisper
app.post("/audio/transcribe", upload.single("audio"), async (req, res) => {
  const GROQ_KEY = req.headers["x-groq-key"];
  if (!GROQ_KEY) return res.status(401).json({ error: "x-groq-key header required" });
  if (!req.file)  return res.status(400).json({ error: "audio file required" });

  const inputPath  = req.file.path;
  const outputPath = inputPath + ".wav";

  try {
    // ffmpeg: converte qualquer formato para WAV 16kHz mono (ideal para Whisper)
    const ffmpeg = process.env.FFMPEG_PATH || "C:\\Users\\pires\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe";
    await execAsync(`"${ffmpeg}" -y -i "${inputPath}" -ar 16000 -ac 1 -f wav "${outputPath}"`);

    // Whisper via Groq
    const form = new FormData();
    form.append("file", fs.createReadStream(outputPath), { filename: "audio.wav", contentType: "audio/wav" });
    form.append("model",           "whisper-large-v3-turbo");
    form.append("language",        "pt");
    form.append("response_format", "json");

    const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, ...form.getHeaders() },
      body:    form,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json();
      throw new Error(err.error?.message ?? `Whisper ${whisperRes.status}`);
    }

    const { text } = await whisperRes.json();
    res.json({ ok: true, text: text?.trim() ?? "" });

  } catch (err) {
    console.error("Audio pipeline error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Limpa arquivos temporários
    try { fs.unlinkSync(inputPath);  } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`🧠 Kira Server → http://localhost:${PORT}`);
  console.log(`🎙 Audio pipeline (ffmpeg + Whisper) ativo`);
  console.log(`📁 Memória → ${MEMORY_FILE}`);
});
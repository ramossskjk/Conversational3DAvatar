import { useState } from "react";
import { readFile, listFiles } from "../services/codeApi";

export function CodePanel({ onSendCode }) {
  const [open,     setOpen]     = useState(false);
  const [filePath, setFilePath] = useState("");
  const [files,    setFiles]    = useState([]);
  const [dirPath,  setDirPath]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleReadFile = async () => {
    if (!filePath.trim()) return;
    setLoading(true); setError("");
    try {
      const result = await readFile(filePath.trim());
      onSendCode(result);
      setFilePath("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleListDir = async () => {
    if (!dirPath.trim()) return;
    setLoading(true); setError("");
    try {
      const { files: f } = await listFiles(dirPath.trim());
      setFiles(f);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      title="Mostrar código para a Kira"
      style={{
        position: "fixed", bottom: "20px", right: "20px",
        background: "linear-gradient(135deg, #a855f7, #ff6eb4)",
        border: "none", borderRadius: "50%", width: "48px", height: "48px",
        color: "white", fontSize: "20px", cursor: "pointer",
        boxShadow: "0 0 20px #a855f755", zIndex: 100,
      }}
    >💻</button>
  );

  return (
    <div style={{
      position: "fixed", bottom: "20px", right: "20px",
      width: "340px", background: "#1a0a2e",
      border: "1px solid #a855f755", borderRadius: "16px",
      padding: "16px", zIndex: 100,
      boxShadow: "0 0 30px #a855f722",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ color: "#ff6eb4", fontWeight: "700", fontSize: "13px" }}>💻 Kira vê seu código</span>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#ffffff44", cursor: "pointer", fontSize: "16px" }}>✕</button>
      </div>

      {/* File path input */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ color: "#ffffff66", fontSize: "11px", marginBottom: "4px" }}>Caminho do arquivo</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={filePath}
            onChange={e => setFilePath(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleReadFile()}
            placeholder="C:/projeto/src/App.jsx"
            style={{
              flex: 1, background: "#ffffff0d", border: "1px solid #ffffff20",
              borderRadius: "8px", padding: "7px 10px",
              color: "white", fontSize: "12px",
            }}
          />
          <button
            onClick={handleReadFile}
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #a855f7, #ff6eb4)",
              border: "none", borderRadius: "8px", padding: "7px 12px",
              color: "white", fontSize: "12px", cursor: "pointer",
            }}
          >{loading ? "..." : "Ler"}</button>
        </div>
      </div>

      {/* Dir listing */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ color: "#ffffff66", fontSize: "11px", marginBottom: "4px" }}>Ou listar pasta</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            value={dirPath}
            onChange={e => setDirPath(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleListDir()}
            placeholder="C:/projeto/src"
            style={{
              flex: 1, background: "#ffffff0d", border: "1px solid #ffffff20",
              borderRadius: "8px", padding: "7px 10px",
              color: "white", fontSize: "12px",
            }}
          />
          <button
            onClick={handleListDir}
            disabled={loading}
            style={{
              background: "#ffffff15", border: "1px solid #ffffff22",
              borderRadius: "8px", padding: "7px 12px",
              color: "white", fontSize: "12px", cursor: "pointer",
            }}
          >Listar</button>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ maxHeight: "160px", overflowY: "auto", marginBottom: "8px" }}>
          {files.map((f, i) => (
            <div
              key={i}
              onClick={() => f.type === "file" && setFilePath(f.path)}
              style={{
                padding: "4px 8px", borderRadius: "6px", fontSize: "11px",
                color: f.type === "dir" ? "#a855f7" : "#ffffff88",
                cursor: f.type === "file" ? "pointer" : "default",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {f.type === "dir" ? "📁" : "📄"} {f.name}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: "#f87171", fontSize: "11px", marginTop: "6px" }}>⚠ {error}</div>
      )}

      <div style={{ color: "#ffffff33", fontSize: "10px", marginTop: "8px" }}>
        Cole o caminho completo do arquivo. A Kira vai ler e opinar~
      </div>
    </div>
  );
}
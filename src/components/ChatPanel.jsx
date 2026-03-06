import { useState } from "react";

const isElectron = typeof window !== "undefined" && !!window.electronAPI;

export function ChatPanel({
  messages, input, setInput, isLoading, chatRef,
  submit, handleKeyDown, clearMemory, serverOnline,
  pendingFact, confirmFact, rejectFact,
  isSearching,
  memoryData,
}) {
  const visible = messages.filter(m => m.role === "user" || m.role === "assistant");
  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents]         = useState([]);

  const openEvents = async () => {
    if (isElectron) {
      const data = await window.electronAPI.getMemory();
      setEvents(data.importantEvents ?? []);
    }
    setShowEvents(true);
  };

  const removeEvent = async (idxOrText) => {
    if (isElectron) await window.electronAPI.removeEvent(idxOrText);
    setEvents(prev => prev.filter((_, i) => i !== idxOrText));
  };

  const purgeExpired = async () => {
    if (isElectron) await window.electronAPI.purgeEvents();
    const data = await window.electronAPI.getMemory();
    setEvents(data.importantEvents ?? []);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", height: "520px",
      background: "#ffffff08", borderRadius: "20px", border: "1px solid #ffffff15",
      overflow: "hidden", backdropFilter: "blur(10px)", position: "relative",
    }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid #ffffff10",
        display: "flex", alignItems: "center", gap: "10px", background: "#ffffff05",
      }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff2d55", animation: "twinkle 2s ease-in-out infinite" }} />
        <span style={{ color: "#ffffff88", fontSize: "13px", fontWeight: "600" }}>Chat ao vivo</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>

          {isSearching && (
            <span style={{ color: "#60a5fa", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "8px", height: "8px", border: "2px solid #60a5fa", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              buscando...
            </span>
          )}

          {isLoading && !isSearching && (
            <span style={{ color: "#ff6eb4", fontSize: "12px" }}>Kira está pensando...</span>
          )}

          {/* Status memória */}
          <div title={serverOnline ? "Memória salva em disco" : "Servidor offline"} style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: "11px", color: serverOnline ? "#4ade80" : "#f87171",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: serverOnline ? "#4ade80" : "#f87171" }} />
            {serverOnline ? "memória ativa" : "servidor offline"}
          </div>

          <div title={`${visible.length} mensagens`} style={{ fontSize: "11px", color: "#a855f788" }}>
            🧠 {visible.length}
          </div>

          {/* Botão eventos */}
          <button
            onClick={openEvents}
            title="Gerenciar eventos da memória"
            style={{
              background: "#ffffff0d", border: "1px solid #ffffff15",
              borderRadius: "8px", color: "#ffffff66", fontSize: "11px",
              padding: "2px 8px", cursor: "pointer",
            }}
          >📅</button>

          {/* Botão limpar chat */}
          <button
            onClick={() => { if (confirm("Limpar histórico do chat? Fatos importantes serão mantidos.")) clearMemory(); }}
            style={{
              background: "#ffffff0d", border: "1px solid #ffffff15",
              borderRadius: "8px", color: "#ffffff44", fontSize: "11px",
              padding: "2px 8px", cursor: "pointer",
            }}
          >🗑</button>
        </div>
      </div>

      {/* ── Mensagens ───────────────────────────────────────────────────────── */}
      <div ref={chatRef} style={{
        flex: 1, overflowY: "auto", padding: "16px",
        display: "flex", flexDirection: "column", gap: "12px",
      }}>
        {visible.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
        {isLoading && <TypingIndicator />}
        {pendingFact && (
          <FactConfirmation
            fact={pendingFact}
            onConfirm={confirmFact}
            onReject={rejectFact}
          />
        )}
      </div>

      {/* ── Input ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 16px", borderTop: "1px solid #ffffff10",
        display: "flex", gap: "10px", background: "#ffffff05",
      }}>
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Fale com a Kira~"
          style={{
            flex: 1, background: "#ffffff0d", border: "1px solid #ffffff20",
            borderRadius: "25px", padding: "10px 18px",
            color: "white", fontSize: "14px", transition: "all 0.2s",
          }}
        />
        <SendButton onClick={submit} disabled={isLoading || !input.trim()} isLoading={isLoading} />
      </div>

      {/* ── Modal de eventos ────────────────────────────────────────────────── */}
      {showEvents && (
        <div style={{
          position: "absolute", inset: 0, background: "#0d011acc",
          backdropFilter: "blur(8px)", borderRadius: "20px",
          display: "flex", flexDirection: "column", padding: "20px", gap: "12px", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "white", fontWeight: "700", fontSize: "14px" }}>📅 Eventos na memória</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={purgeExpired}
                title="Remover eventos expirados"
                style={{
                  background: "#ffffff0d", border: "1px solid #ffffff20",
                  borderRadius: "8px", color: "#f87171", fontSize: "11px",
                  padding: "4px 10px", cursor: "pointer",
                }}
              >🗑 Limpar expirados</button>
              <button
                onClick={() => setShowEvents(false)}
                style={{
                  background: "#ffffff0d", border: "1px solid #ffffff20",
                  borderRadius: "8px", color: "#ffffff66", fontSize: "13px",
                  padding: "4px 10px", cursor: "pointer",
                }}
              >✕</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {events.length === 0 ? (
              <div style={{ color: "#ffffff44", fontSize: "13px", textAlign: "center", marginTop: "40px" }}>
                Nenhum evento salvo.
              </div>
            ) : events.map((ev, i) => {
              const text      = ev.text ?? ev;
              const expiresAt = ev.expiresAt ? new Date(ev.expiresAt) : null;
              const expired   = expiresAt && expiresAt < new Date();

              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: expired ? "#f8717115" : "#ffffff0d",
                  border: `1px solid ${expired ? "#f8717133" : "#ffffff15"}`,
                  borderRadius: "10px", padding: "8px 12px", gap: "8px",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: expired ? "#f87171aa" : "#ffffffcc", fontSize: "13px" }}>
                      {expired && "⚠️ "}{text}
                    </div>
                    {expiresAt && (
                      <div style={{ fontSize: "10px", color: expired ? "#f87171" : "#ffffff44", marginTop: "2px" }}>
                        {expired ? "Expirado em" : "Expira em"} {expiresAt.toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeEvent(i)}
                    style={{
                      background: "transparent", border: "none",
                      color: "#ffffff33", fontSize: "14px",
                      cursor: "pointer", padding: "2px 6px", flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function FactConfirmation({ fact, onConfirm, onReject }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%",
        background: "linear-gradient(135deg, #ff6eb4, #a855f7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "14px", flexShrink: 0,
      }}>★</div>
      <div style={{
        maxWidth: "80%", padding: "10px 14px",
        borderRadius: "18px 18px 18px 4px",
        background: "#ffffff12", border: "1px solid #a855f755",
        color: "white", fontSize: "13px", lineHeight: "1.5",
      }}>
        <div style={{ fontSize: "10px", color: "#ff6eb4", fontWeight: "700", marginBottom: "6px" }}>Kira~</div>
        <span style={{ color: "#ffffffcc" }}>Posso guardar isso na memória? 💾</span>
        <div style={{
          marginTop: "8px", padding: "6px 10px",
          background: "#a855f722", borderRadius: "8px",
          fontSize: "12px", color: "#e0aaff", fontStyle: "italic",
        }}>"{fact}"</div>
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <button onClick={onConfirm} style={{
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
            border: "none", borderRadius: "12px", padding: "4px 14px",
            color: "white", fontSize: "12px", cursor: "pointer", fontWeight: "600",
          }}>✅ Sim!</button>
          <button onClick={onReject} style={{
            background: "#ffffff15", border: "1px solid #ffffff20",
            borderRadius: "12px", padding: "4px 14px",
            color: "#ffffff88", fontSize: "12px", cursor: "pointer",
          }}>❌ Não</button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className="msg-bubble" style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-end", gap: "8px",
    }}>
      {!isUser && (
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "linear-gradient(135deg, #ff6eb4, #a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "14px", flexShrink: 0,
        }}>★</div>
      )}
      <div style={{
        maxWidth: "80%", padding: "10px 14px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "linear-gradient(135deg, #ff6eb4, #a855f7)" : "#ffffff12",
        color: "white", fontSize: "14px", lineHeight: "1.5",
        border: !isUser ? "1px solid #ffffff15" : "none",
      }}>
        {!isUser && <div style={{ fontSize: "10px", color: "#ff6eb4", fontWeight: "700", marginBottom: "4px" }}>Kira~</div>}
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-bubble" style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%",
        background: "linear-gradient(135deg, #ff6eb4, #a855f7)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
      }}>★</div>
      <div style={{
        padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
        background: "#ffffff12", border: "1px solid #ffffff15",
        display: "flex", gap: "5px", alignItems: "center",
      }}>
        {[0,1,2].map(j => (
          <div key={j} style={{
            width: "6px", height: "6px", borderRadius: "50%", background: "#ff6eb4",
            animation: "twinkle 1s ease-in-out infinite", animationDelay: `${j * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

function SendButton({ onClick, disabled, isLoading }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#ffffff15" : "linear-gradient(135deg, #ff6eb4, #a855f7)",
      border: "none", borderRadius: "50%", width: "42px", height: "42px",
      color: "white", fontSize: "18px", cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      {isLoading
        ? <div style={{ width: "16px", height: "16px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        : "↑"}
    </button>
  );
}
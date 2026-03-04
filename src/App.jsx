
import "./styles/globals.css";
import { BackgroundParticles } from "./components/BackgroundParticles";
import { StreamFrame }         from "./components/StreamFrame";
import { ChatPanel }           from "./components/ChatPanel";
import { useKiraChat }         from "./hooks/useKiraChat";

const VRM_URL = "/AvatarSample_M.vrm";

export default function App() {
  const {
    messages, input, setInput,
    isLoading, mood, setMood,
    isTalking, chatRef,
    submit, handleKeyDown, clearMemory,
    serverOnline,
    pendingFact, confirmFact, rejectFact, // ✅ adicionado
  } = useKiraChat();

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "20px",
    }}>
      <BackgroundParticles />
      <div style={{ display: "flex", gap: "24px", width: "100%", maxWidth: "980px", alignItems: "flex-start" }}>
        <StreamFrame mood={mood} setMood={setMood} isTalking={isTalking} vrmUrl={VRM_URL} />
        <ChatPanel
          messages={messages} input={input} setInput={setInput}
          isLoading={isLoading} chatRef={chatRef}
          submit={submit} handleKeyDown={handleKeyDown}
          clearMemory={clearMemory}
          serverOnline={serverOnline}
          pendingFact={pendingFact}   // ✅ adicionado
          confirmFact={confirmFact}   // ✅ adicionado
          rejectFact={rejectFact}     // ✅ adicionado
        />
      </div>
    </div>
  );
}

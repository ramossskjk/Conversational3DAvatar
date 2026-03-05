import "./styles/globals.css";
import { BackgroundParticles } from "./components/BackgroundParticles";
import { StreamFrame }         from "./components/StreamFrame";
import { ChatPanel }           from "./components/ChatPanel";
import { CodePanel }           from "./components/CodePanel";
import { useKiraChat }         from "./hooks/useKiraChat";
import { useMicrophone }       from "./hooks/useMicrophone";

const VRM_URL = "/AvatarSample_M.vrm";

export default function App() {
  const {
    messages, input, setInput,
    isLoading, mood, setMood,
    isTalking, chatRef,
    submit, handleKeyDown,
    clearMemory, serverOnline,
    sendCodeContext,
  } = useKiraChat();

  const { isListening, isProcessing, transcript, micError, start, stop, supported } = useMicrophone({
    onResult: (text) => {
      setInput(text);
      setTimeout(() => submit(), 100);
    },
  });

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
          clearMemory={clearMemory} serverOnline={serverOnline}
          isListening={isListening} isProcessing={isProcessing}
          transcript={transcript} micError={micError}
          startListening={start} stopListening={stop} micSupported={supported}
        />
      </div>

      {/* Botão flutuante para enviar código */}
      <CodePanel onSendCode={sendCodeContext} />
    </div>
  );
}
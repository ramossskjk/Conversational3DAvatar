import { useEffect } from "react";
import { AvatarVRM } from "./components/AvatarVRM";
import { useKiraChat } from "./hooks/useKiraChat";
import "./styles/globals.css";

const VRM_URL = "/AvatarSample_M.vrm";

export default function Overlay() {
  const { mood, isTalking } = useKiraChat();

  useEffect(() => {
    // Fundo totalmente transparente para o OBS capturar
    document.body.style.background    = "transparent";
    document.documentElement.style.background = "transparent";
  }, []);

  return (
    <div style={{
      width: "300px", height: "500px",
      background: "transparent",
      position: "relative",
    }}>
      <AvatarVRM modelUrl={VRM_URL} mood={mood} isTalking={isTalking} />
    </div>
  );
}
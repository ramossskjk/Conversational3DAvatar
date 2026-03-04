import { Suspense, lazy } from "react";
import { Avatar } from "./Avatar";
import { MOOD_LABELS } from "../constants/moods";

const AvatarVRM = lazy(() =>
  import("./AvatarVRM").then(m => ({ default: m.AvatarVRM }))
);

export function StreamFrame({ mood, setMood, isTalking, vrmUrl }) {
  const is3D = !!vrmUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", flexShrink: 0 }}>
      <div style={{
        position: "relative",
        background: "linear-gradient(180deg, #1a0a2e 0%, #0d0118 100%)",
        border: "2px solid #a855f755",
        borderRadius: "20px",
        animation: "pulse-glow 3s ease-in-out infinite",
        width:  is3D ? "360px" : "auto",
        height: is3D ? "540px" : "auto",
        padding: is3D ? "0" : "20px 20px 10px",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "12px", left: "12px", zIndex: 10,
          background: "#ff2d55", color: "white", fontSize: "10px",
          fontWeight: "800", padding: "2px 8px", borderRadius: "4px", letterSpacing: "1px",
        }}>● LIVE</div>

        <div style={{
          position: "absolute", top: "12px", right: "12px", zIndex: 10,
          color: "#ffffff88", fontSize: "10px",
        }}>👁 1,337</div>

        {is3D ? (
          <Suspense fallback={
            <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"#ff6eb488" }}>
              Carregando modelo...
            </div>
          }>
            <div style={{ width: "100%", height: "100%" }}>
              <AvatarVRM modelUrl={vrmUrl} mood={mood} isTalking={isTalking} />
            </div>
          </Suspense>
        ) : (
          <div style={{ animation: "float 4s ease-in-out infinite", marginTop: "10px" }}>
            <Avatar mood={mood} isTalking={isTalking} />
          </div>
        )}

        <div style={{
          position: is3D ? "absolute" : "relative",
          bottom: is3D ? "12px" : "auto",
          left: 0, right: 0, zIndex: 10,
          textAlign: "center", marginTop: is3D ? 0 : "4px",
        }}>
          <div style={{
            color: "#ff6eb4", fontWeight: "800", fontSize: "18px",
            textShadow: "0 0 10px #ff6eb4, 0 0 30px #ff6eb466", letterSpacing: "2px",
          }}>✦ KIRA ✦</div>
          <div style={{ color: "#a855f788", fontSize: "11px" }}>AI VTuber</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
        {MOOD_LABELS.map(m => (
          <button key={m} onClick={() => setMood(m)} style={{
            background: mood === m ? "#a855f7" : "#ffffff11",
            border: `1px solid ${mood === m ? "#a855f7" : "#ffffff22"}`,
            color: mood === m ? "white" : "#ffffff66",
            borderRadius: "20px", padding: "3px 10px", fontSize: "10px",
            cursor: "pointer", transition: "all 0.2s", textTransform: "capitalize",
          }}>{m}</button>
        ))}
      </div>
    </div>
  );
}

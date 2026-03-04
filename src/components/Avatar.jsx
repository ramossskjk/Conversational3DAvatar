import { useState, useEffect } from "react";
import { MOODS } from "../constants/moods";

/**
 * Animated SVG avatar for Kira.
 * Props:
 *   mood      - keyof MOODS
 *   isTalking - bool
 */
export function Avatar({ mood, isTalking }) {
  const [blink, setBlink]         = useState(false);
  const [mouthPhase, setMouthPhase] = useState(0);

  // Random blink
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, Math.random() * 2000 + 2000);
    return () => clearInterval(id);
  }, []);

  // Mouth animation while talking
  useEffect(() => {
    if (!isTalking) { setMouthPhase(0); return; }
    const id = setInterval(() => setMouthPhase(p => (p + 1) % 4), 120);
    return () => clearInterval(id);
  }, [isTalking]);

  const m      = MOODS[mood] ?? MOODS.idle;
  const eyeH   = blink ? 2 : 22 * m.eyeScale;
  const mouthH = isTalking ? [4, 10, 16, 8][mouthPhase] : m.mouthOpen * 12;

  return (
    <svg viewBox="0 0 200 220" width="200" height="220"
         style={{ filter: "drop-shadow(0 0 20px #ff6eb4aa)" }}>
      {/* Hair back */}
      <ellipse cx="100" cy="85" rx="72" ry="78" fill="#1a0a2e" />
      <path d="M28 85 Q20 160 35 200 Q50 180 55 160" fill="#1a0a2e" />
      <path d="M172 85 Q180 160 165 200 Q150 180 145 160" fill="#1a0a2e" />
      <path d="M55 30 Q70 15 100 20 Q115 18 125 25"
            stroke="#6a2fa0" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6"/>

      {/* Neck */}
      <rect x="84" y="168" width="32" height="28" rx="8" fill="#ffd6c8" />

      {/* Face */}
      <ellipse cx="100" cy="105" rx="62" ry="68" fill="#ffd6c8" />

      {/* Ears */}
      <ellipse cx="38"  cy="105" rx="10" ry="14" fill="#ffd6c8" />
      <ellipse cx="162" cy="105" rx="10" ry="14" fill="#ffd6c8" />
      <ellipse cx="38"  cy="105" rx="6"  ry="9"  fill="#ffb4a8" opacity="0.5" />
      <ellipse cx="162" cy="105" rx="6"  ry="9"  fill="#ffb4a8" opacity="0.5" />

      {/* Blush */}
      <ellipse cx="68"  cy="120" rx="16" ry="9" fill="#ff9db0" opacity={m.blushOpacity} />
      <ellipse cx="132" cy="120" rx="16" ry="9" fill="#ff9db0" opacity={m.blushOpacity} />

      {/* Eyebrows */}
      <path d={`M72 ${82+m.eyebrowY} Q82 ${76+m.eyebrowY} 92 ${82+m.eyebrowY}`}
            stroke="#3d1a6e" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d={`M108 ${82+m.eyebrowY} Q118 ${76+m.eyebrowY} 128 ${82+m.eyebrowY}`}
            stroke="#3d1a6e" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* Left eye */}
      <ellipse cx="82" cy="102" rx="16" ry={eyeH} fill="#1a0a2e" />
      {!blink && <>
        <ellipse cx="82" cy="102" rx="10" ry={eyeH * 0.6} fill="#a855f7" />
        <ellipse cx="82" cy="102" rx="6"  ry={eyeH * 0.4} fill="#1a0a2e" />
        <circle cx="87" cy="97" r="3"   fill="white" opacity="0.9" />
        <circle cx="79" cy="106" r="1.5" fill="white" opacity="0.5" />
      </>}

      {/* Right eye */}
      <ellipse cx="118" cy="102" rx="16" ry={eyeH} fill="#1a0a2e" />
      {!blink && <>
        <ellipse cx="118" cy="102" rx="10" ry={eyeH * 0.6} fill="#a855f7" />
        <ellipse cx="118" cy="102" rx="6"  ry={eyeH * 0.4} fill="#1a0a2e" />
        <circle cx="123" cy="97" r="3"   fill="white" opacity="0.9" />
        <circle cx="115" cy="106" r="1.5" fill="white" opacity="0.5" />
      </>}

      {/* Nose */}
      <ellipse cx="100" cy="122" rx="4" ry="2.5" fill="#ffb4a8" opacity="0.7" />

      {/* Mouth */}
      <path d={`M88 138 Q100 ${138 + mouthH} 112 138`}
            stroke="#e8647a" strokeWidth="2.5"
            fill={mouthH > 4 ? "#c0394f" : "none"}
            strokeLinecap="round" />
      {mouthH > 6 && <path d={`M91 139 Q100 141 109 139`} fill="white" />}

      {/* Hair front */}
      <path d="M38 75 Q45 25 100 20 Q155 25 162 75" fill="#1a0a2e" />
      <path d="M38 75 Q42 55 55 60 Q50 85 45 95" fill="#1a0a2e" />
      <path d="M162 75 Q158 55 145 60 Q150 85 155 95" fill="#1a0a2e" />
      <path d="M55 60 Q65 45 75 65" fill="#1a0a2e" />
      <path d="M72 55 Q82 40 92 62" fill="#1a0a2e" />
      <path d="M108 62 Q118 40 128 55" fill="#1a0a2e" />
      <path d="M125 65 Q135 45 145 60" fill="#1a0a2e" />

      {/* Cat ears */}
      <path d="M60 35 L48 5 L76 28 Z" fill="#1a0a2e" />
      <path d="M140 35 L152 5 L124 28 Z" fill="#1a0a2e" />
      <path d="M62 33 L52 10 L74 29 Z" fill="#a855f7" opacity="0.5" />
      <path d="M138 33 L148 10 L126 29 Z" fill="#a855f7" opacity="0.5" />
    </svg>
  );
}

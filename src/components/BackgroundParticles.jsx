const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size:  Math.random() * 4 + 1,
  color: i % 2 === 0 ? "#bb4c82" : "#791ece",
  left:  Math.random() * 100,
  top:   Math.random() * 100,
  delay: Math.random() * 3,
  duration: Math.random() * 3 + 2,
}));

/**
 * Fixed decorative star-particles in the background.
 * Rendered once; values are stable (generated at module load time).
 */
export function BackgroundParticles() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {PARTICLES.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          width:  `${p.size}px`,
          height: `${p.size}px`,
          borderRadius: "50%",
          background: p.color,
          left: `${p.left}%`,
          top:  `${p.top}%`,
          animation: `twinkle ${p.duration}s ease-in-out infinite`,
          animationDelay: `${p.delay}s`,
          opacity: 0.6,
        }} />
      ))}
    </div>
  );
}

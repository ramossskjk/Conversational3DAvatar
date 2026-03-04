export const MOODS = {
  idle:      { eyeScale: 1,   mouthOpen: 0,   blushOpacity: 0,   eyebrowY: 0  },
  happy:     { eyeScale: 0.7, mouthOpen: 0.6, blushOpacity: 0.8, eyebrowY: -3 },
  talking:   { eyeScale: 1,   mouthOpen: 0.8, blushOpacity: 0.3, eyebrowY: 0  },
  thinking:  { eyeScale: 0.9, mouthOpen: 0.1, blushOpacity: 0.1, eyebrowY: -5 },
  surprised: { eyeScale: 1.3, mouthOpen: 0.9, blushOpacity: 0.5, eyebrowY: -8 },
};

export const MOOD_LABELS = Object.keys(MOODS);

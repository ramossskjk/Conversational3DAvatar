// Detecta o mood da Kira a partir do texto da resposta
// Sem custo de API — regex/keywords no frontend

// Moods disponíveis no AvatarVRM:
// happy | talking | idle | thinking | surprised | excited | embarrassed | confused | wink

const MOOD_PATTERNS = [
  {
    mood: "surprised",
    patterns: [
      /sério\??|de verdade\??|nossa[!?]|uau[!?]|wow[!?]|que incrível|não acredito|que surpresa|nossa isso/i,
    ],
  },
  {
    mood: "embarrassed",
    patterns: [
      /fico envergonhada|fico tímida|que fofo|obrigada.*elogio|você me elogiando|me deixa corada|hehe~|ehehe|awn/i,
    ],
  },
  {
    mood: "excited",
    patterns: [
      /incrível!|que demais!|adorei!|amei!|isso é incrível|que emocionante|vai ficar incrível|que ideia boa|perfeito!|oba[!~]/i,
    ],
  },
  {
    mood: "confused",
    patterns: [
      /não entendi|pode repetir|não tenho certeza|não sei ao certo|hmm+\.\.\.|tô confusa|estou confusa|não ficou claro/i,
    ],
  },
  {
    mood: "thinking",
    patterns: [
      /deixa eu pensar|interessante\.\.\.|bom\.\.\.|vamos ver|analisando|considerando|por um lado|por outro lado/i,
    ],
  },
  {
    mood: "wink",
    patterns: [
      /brincadeira!|tô brincando|pode apostar!|óbvio né|claro que sim!|nem me fala/i,
    ],
  },
  {
    mood: "idle",
    patterns: [
      /com certeza|pode ser|quando quiser|qualquer hora/i,
    ],
  },
];

const HIGH_PRIORITY = ["surprised", "embarrassed", "excited", "confused"];

export function detectMoodFromReply(text) {
  if (!text) return "happy";

  const high = MOOD_PATTERNS
    .filter(p => HIGH_PRIORITY.includes(p.mood))
    .find(p => p.patterns.some(r => r.test(text)));

  if (high) return high.mood;

  const any = MOOD_PATTERNS
    .find(p => p.patterns.some(r => r.test(text)));

  return any?.mood ?? "happy";
}
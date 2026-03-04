import { KIRA_SYSTEM_PROMPT, KIRA_ERROR_MESSAGE } from "../constants/persona";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function sendMessage(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        { role: "system", content: KIRA_SYSTEM_PROMPT },
        ...messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(({ role, content }) => ({ role, content })),
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error("Groq API error:", err);
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? KIRA_ERROR_MESSAGE;
}

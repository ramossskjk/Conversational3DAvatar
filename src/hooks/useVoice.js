import { useRef, useCallback } from "react";

const ELEVENLABS_KEY     = import.meta.env.VITE_ELEVENLABS_KEY;
const ELEVENLABS_VOICE   = import.meta.env.VITE_ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_API_URL = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`;

/**
 * Hook de voz. Prioridade:
 *   1. ElevenLabs (se VITE_ELEVENLABS_KEY estiver no .env)
 *   2. Web Speech API (gratis, nativo do browser)
 */
export function useVoice() {
  const audioRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    synthRef.current?.cancel();
  }, []);

  const speakElevenLabs = useCallback(async (text) => {
    const res = await fetch(ELEVENLABS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audioRef.current = audio;
    audio.play();
  }, []);

  const speakWebSpeech = useCallback((text) => {
    const synth     = synthRef.current;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices    = synth.getVoices();
    const ptVoice   = voices.find(v => v.lang === "pt-BR");
    if (ptVoice) utterance.voice = ptVoice;
    utterance.lang  = "pt-BR";
    utterance.rate  = 1.1;
    utterance.pitch = 1.4;
    synth.cancel();
    synth.speak(utterance);
  }, []);

  const speak = useCallback(async (text) => {
    stop();
    if (ELEVENLABS_KEY) {
      try { await speakElevenLabs(text); return; }
      catch (e) { console.warn("ElevenLabs falhou, usando Web Speech:", e); }
    }
    speakWebSpeech(text);
  }, [stop, speakElevenLabs, speakWebSpeech]);

  return { speak, stop };
}

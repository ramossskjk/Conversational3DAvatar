import { useRef, useCallback } from "react";

const ELEVENLABS_KEY   = import.meta.env.VITE_ELEVENLABS_KEY;
const ELEVENLABS_VOICE = import.meta.env.VITE_ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

export function useVoice() {
  const audioRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    synthRef.current?.cancel();
  }, []);

  // ElevenLabs — voz realista (requer chave)
  const speakElevenLabs = useCallback(async (text, onEnd) => {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_KEY },
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
    audio.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
    audioRef.current = audio;
    audio.play();
  }, []);

  // Web Speech API — grátis, qualidade menor
  const speakWebSpeech = useCallback((text, onEnd) => {
    const synth     = synthRef.current;
    const utterance = new SpeechSynthesisUtterance(text);
    // Espera vozes carregarem
    const setVoice  = () => {
      const voices  = synth.getVoices();
      const ptVoice = voices.find(v => v.lang === "pt-BR") ?? voices.find(v => v.lang.startsWith("pt"));
      if (ptVoice) utterance.voice = ptVoice;
    };
    setVoice();
    if (synth.getVoices().length === 0) speechSynthesis.onvoiceschanged = setVoice;
    utterance.lang    = "pt-BR";
    utterance.rate    = 1.1;
    utterance.pitch   = 1.3;
    utterance.onend   = onEnd;
    synth.cancel();
    synth.speak(utterance);
  }, []);

  const speak = useCallback(async (text, onEnd) => {
    stop();
    if (ELEVENLABS_KEY) {
      try { await speakElevenLabs(text, onEnd); return; }
      catch (e) { console.warn("ElevenLabs falhou, usando Web Speech:", e); }
    }
    speakWebSpeech(text, onEnd);
  }, [stop, speakElevenLabs, speakWebSpeech]);

  return { speak, stop };
}
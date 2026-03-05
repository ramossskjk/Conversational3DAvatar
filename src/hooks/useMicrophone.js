import { useState, useRef, useCallback } from "react";

const SERVER   = "http://localhost:3001";
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY;

export function useMicrophone({ onResult, onError } = {}) {
  const [isListening,   setIsListening]   = useState(false);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [micError,      setMicError]      = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);

  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices;

  const start = useCallback(async () => {
    if (isListening || isProcessing) return;
    setMicError("");

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsListening(false);
        setIsProcessing(true);

        try {
          const blob     = new Blob(chunksRef.current, { type: mimeType });
          const ext      = mimeType.split("/")[1];
          const formData = new FormData();
          formData.append("audio", blob, `recording.${ext}`);

          // Envia para o backend processar com ffmpeg + Whisper
          const res = await fetch(`${SERVER}/audio/transcribe`, {
            method:  "POST",
            headers: { "x-groq-key": GROQ_KEY },
            body:    formData,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Erro na transcrição");

          if (data.text) {
            onResult?.(data.text);
          } else {
            setMicError("Não entendi nada, tenta falar de novo~");
          }
        } catch (e) {
          console.error("Mic error:", e);
          setMicError(e.message);
          onError?.(e);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);

    } catch (e) {
      const msg = e.name === "NotAllowedError"
        ? "Permissão de microfone negada — habilite nas configurações do Chrome"
        : `Erro ao acessar microfone: ${e.message}`;
      setMicError(msg);
      onError?.(e);
    }
  }, [isListening, isProcessing, onResult, onError]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { isListening, isProcessing, micError, start, stop, supported };
}
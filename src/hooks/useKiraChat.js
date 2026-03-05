import { useState, useRef, useEffect } from "react";
import { sendMessage, detectFact }     from "../services/groqApi";
import { loadMemory, saveMemory, clearMemory as clearServer, checkServer, saveFact } from "../services/memoryApi";
import { useVoice }      from "./useVoice";
import { KIRA_INITIAL_MESSAGE, KIRA_ERROR_MESSAGE } from "../constants/persona";

export function useKiraChat() {
  const [messages, setMessages]         = useState([KIRA_INITIAL_MESSAGE]);
  const [input, setInput]               = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [mood, setMood]                 = useState("happy");
  const [isTalking, setIsTalking]       = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [pendingFact, setPendingFact]   = useState(null);
  const [memoryData, setMemoryData]     = useState({ facts: [], summary: "" });
  const chatRef      = useRef(null);
  const talkTimerRef = useRef(null);
  const saveTimer    = useRef(null);
  const { speak, stop } = useVoice();

  useEffect(() => {
    (async () => {
      const { messages: saved, facts, summary } = await loadMemory();
      const online = await checkServer();
      setServerOnline(!!online);
      setMemoryData({ facts, summary });

      if (saved?.length > 0) {
        setMessages([...saved]);
      } else {
        setMessages([KIRA_INITIAL_MESSAGE]);
      }
    })();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isLoading, pendingFact]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = messages.filter(m => m.role === "user" || m.role === "assistant");
      if (toSave.length > 0) saveMemory(toSave);
    }, 300);
  }, [messages]);

  const confirmFact = async () => {
    if (!pendingFact) return;
    await saveFact(pendingFact);
    setMemoryData(prev => ({
      ...prev,
      facts: [...new Set([...prev.facts, pendingFact])],
    }));
    setPendingFact(null);
  };

  const rejectFact = () => setPendingFact(null);

  const clearMemory = async () => {
    await clearServer();
    const { facts, summary } = await loadMemory();
    setMemoryData({ facts, summary });
    setMessages([KIRA_INITIAL_MESSAGE]);
  };

  // ✅ Kira fala e controla lip sync
  const kiraSpeak = (text) => {
    setIsTalking(true);
    setMood("talking");
    speak(text, () => {
      setIsTalking(false);
      setMood("happy");
    });
    clearTimeout(talkTimerRef.current);
    talkTimerRef.current = setTimeout(() => {
      setIsTalking(false);
      setMood("happy");
    }, Math.min(text.length * 80, 12000));
  };

  const submit = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg  = { role: "user", content: input.trim() };
    const nextMsgs = [...messages, userMsg];

    setMessages(nextMsgs);
    setInput("");
    stop();
    setIsLoading(true);
    setMood("thinking");

    try {
      const apiMsgs = nextMsgs.filter(m => m.role === "user" || m.role === "assistant");

      const [reply, fact] = await Promise.all([
        sendMessage(apiMsgs, memoryData.facts, memoryData.summary),
        detectFact(userMsg.content),
      ]);

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      setMood("happy");
      kiraSpeak(reply); // ✅ Kira fala a resposta

      if (fact) setPendingFact(fact);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "assistant", content: KIRA_ERROR_MESSAGE }]);
      setMood("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return {
    messages, input, setInput,
    isLoading, mood, setMood,
    isTalking, chatRef,
    submit, handleKeyDown,
    clearMemory, serverOnline,
    pendingFact, confirmFact, rejectFact,
  };
}
import { useState, useRef, useEffect } from "react";
import { sendMessage, detectFact }     from "../services/groqApi";
import {
  loadMemory, saveMemory,
  clearMemory as clearServer,
  checkServer, saveFact,
} from "../services/memoryApi";
import { KIRA_INITIAL_MESSAGE, KIRA_ERROR_MESSAGE } from "../constants/persona";
import { detectMoodFromReply } from "../utils/detectmood";

const isElectron = typeof window !== "undefined" && !!window.electronAPI;

export function useKiraChat() {
  const [messages, setMessages]         = useState([KIRA_INITIAL_MESSAGE]);
  const [input, setInput]               = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [mood, setMood]                 = useState("happy");
  const [isTalking, setIsTalking]       = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [pendingFact, setPendingFact]   = useState(null);
  const [isSearching, setIsSearching]   = useState(false);
  const [memoryData, setMemoryData]     = useState({
    facts:           [],
    summary:         "",
    importantEvents: [],
  });

  const chatRef      = useRef(null);
  const talkTimerRef = useRef(null);
  const saveTimer    = useRef(null);

  // Carrega memória ao iniciar
  useEffect(() => {
    (async () => {
      const { recentMessages, facts, summary, importantEvents } = await loadMemory();
      const online = await checkServer();
      setServerOnline(!!online);
      setMemoryData({ facts, summary, importantEvents });

      if (recentMessages?.length > 0) {
        setMessages([...recentMessages]);
      } else {
        setMessages([KIRA_INITIAL_MESSAGE]);
      }
    })();
  }, []);

  // Scroll automático
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isLoading, pendingFact]);

  // Salva mensagens com debounce
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSave = messages.filter(m => m.role === "user" || m.role === "assistant");
      if (toSave.length === 0) return;

      const result = await saveMemory(toSave);

      if (result?.summarized) {
        const { facts, summary, importantEvents } = await loadMemory();
        setMemoryData({ facts, summary, importantEvents });
      }
    }, 300);
  }, [messages]);

  // ── Busca na web ──────────────────────────────────────────────────────────
  const runWebSearch = async (userMessage) => {
    if (!isElectron) return "";
    try {
      const decision = await window.electronAPI.searchShould(userMessage);
      if (!decision?.search) return "";

      console.log(`🔍 Kira vai buscar: "${decision.query}"`);
      setIsSearching(true);

      const { ok, formatted } = await window.electronAPI.searchRun(decision.query);
      return ok ? formatted : "";
    } catch (err) {
      console.error("Erro na busca:", err);
      return "";
    } finally {
      setIsSearching(false);
    }
  };

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
    const { facts, summary, importantEvents } = await loadMemory();
    setMemoryData({ facts, summary, importantEvents });
    setMessages([KIRA_INITIAL_MESSAGE]);
  };

  const submit = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg  = { role: "user", content: input.trim() };
    const nextMsgs = [...messages, userMsg];

    setMessages(nextMsgs);
    setInput("");
    setIsLoading(true);
    setMood("thinking");

    try {
      const apiMsgs = nextMsgs.filter(m => m.role === "user" || m.role === "assistant");

      // Busca web e detectFact em paralelo
      const [searchContext, fact] = await Promise.all([
        runWebSearch(userMsg.content),
        detectFact(userMsg.content),
      ]);

      if (searchContext) console.log("📡 Contexto da web injetado no prompt");

      const reply = await sendMessage(
        apiMsgs,
        memoryData.facts,
        memoryData.summary,
        memoryData.importantEvents,
        searchContext,
      );

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);

      const detectedMood = detectMoodFromReply(reply);
      setMood(detectedMood);

      if (fact) setPendingFact(fact);

      const duration = Math.min(reply.length * 60, 6000);
      setIsTalking(true);
      clearTimeout(talkTimerRef.current);
      talkTimerRef.current = setTimeout(() => {
        setIsTalking(false);
        setMood("happy");
      }, duration);
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
    memoryData,
    isSearching,
  };
}
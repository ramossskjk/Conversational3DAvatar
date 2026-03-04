import { useState, useRef, useEffect } from "react";
import { sendMessage, detectFact }     from "../services/groqApi";
import { loadMemory, saveMemory, clearMemory as clearServer, checkServer, saveFact } from "../services/memoryApi";
import { KIRA_INITIAL_MESSAGE, KIRA_ERROR_MESSAGE } from "../constants/persona";

export function useKiraChat() {
  const [messages, setMessages]         = useState([KIRA_INITIAL_MESSAGE]);
  const [input, setInput]               = useState("");
  const [isLoading, setIsLoading]       = useState(false);
  const [mood, setMood]                 = useState("happy");
  const [isTalking, setIsTalking]       = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [pendingFact, setPendingFact]   = useState(null);
  const [memoryData, setMemoryData]     = useState({ facts: [], summary: "" }); // ✅ facts no estado
  const chatRef      = useRef(null);
  const talkTimerRef = useRef(null);
  const saveTimer    = useRef(null);

  useEffect(() => {
    (async () => {
      const { messages: saved, facts, summary } = await loadMemory();
      const online = await checkServer();
      setServerOnline(!!online);
      setMemoryData({ facts, summary }); // ✅ salva facts no estado

      if (saved?.length > 0) {
        setMessages([...saved]); // ✅ sem injetar system msgs, facts vão pelo prompt
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
    // ✅ Atualiza facts local imediatamente sem precisar recarregar
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
    setMemoryData({ facts, summary }); // ✅ mantém facts após limpar
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

      const [reply, fact] = await Promise.all([
        sendMessage(apiMsgs, memoryData.facts, memoryData.summary), // ✅ passa facts e summary
        detectFact(userMsg.content),
      ]);

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      setMood("happy");

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
  };
}

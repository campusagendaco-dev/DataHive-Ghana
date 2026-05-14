import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, ChevronDown, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Message {
  id?: string;
  role: "user" | "bot";
  text: string;
  ts: Date;
}

const QUICK_ACTIONS = [
  "Check my balance",
  "Order failed",
  "How to withdraw?",
  "Top up wallet",
  "Sub-agent setup",
];

const WELCOME: Message = {
  role: "bot",
  text: "👋 Hi! I'm Ama, your AI assistant. How can I help you today?",
  ts: new Date(),
};

function fmt(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AIConcierge() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const initChat = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load History
      const { data: history } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(20);

      if (history && history.length > 0) {
        setMessages(history.map(m => ({
          id: m.id,
          role: m.role as any,
          text: m.content,
          ts: new Date(m.created_at)
        })));
      }
    };
    initChat();
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || typing) return;
    setInput("");

    const { data: { user } } = await supabase.auth.getUser();
    
    // Optimistic user message
    const userMsg: Message = { role: "user", text: msg, ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      // Save user message to DB
      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "user",
          content: msg
        });
      }

      // Gather Super Context
      const [profile, orders] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle(),
        supabase.from("orders").select("*").eq("agent_id", user?.id).order("created_at", { ascending: false }).limit(3)
      ]);

      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.text,
      }));

      const { data } = await supabase.functions.invoke("oracle-ai", {
        body: {
          context: { 
            userMessage: msg, 
            currentPath: window.location.pathname,
            profile: profile.data,
            recentOrders: orders.data
          },
          history,
        },
      });

      const reply = data?.oracle_opinion || "I'm here to help! Please try again.";
      const botMsg: Message = { role: "bot", text: reply, ts: new Date() };
      setMessages(prev => [...prev, botMsg]);

      // Speak back if enabled
      if (isSpeaking) {
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = "en-GH";
        utterance.pitch = 1.3; // Higher pitch for younger girl voice
        utterance.rate = 1.05; // Slightly faster, youthful pace
        window.speechSynthesis.speak(utterance);
      }

      // Save bot reply to DB
      if (user) {
        await supabase.from("chat_messages").insert({
          user_id: user.id,
          role: "bot",
          content: reply
        });
      }

      if (!open) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: "bot",
        text: "Connection issue — please try again in a moment! 😊",
        ts: new Date(),
      }]);
    } finally {
      setTyping(false);
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser! 😊");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "en-GH"; // Ghanaian English vibe

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = () => setIsListening(false);
    
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      // Auto-send if it sounds like a command? For now just fill input.
    };

    recognitionRef.current.start();
  };

  return (
    <motion.div 
      drag
      dragMomentum={false}
      initial={{ x: "-50%", y: -100, opacity: 0 }}
      animate={{ x: "-50%", y: 0, opacity: 1 }}
      whileDrag={{ scale: 1.05, cursor: "grabbing" }}
      className="fixed top-10 left-1/2 z-[9999] flex flex-col items-center gap-3 cursor-grab"
      style={{ translateX: "-50%" }}
    >

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="w-[360px] sm:w-[400px] flex flex-col rounded-[28px] overflow-hidden shadow-2xl"
            style={{
              height: "min(560px, 85dvh)",
              background: "linear-gradient(160deg,rgba(15,15,26,0.95) 0%,rgba(10,10,18,0.98) 60%,#080810 100%)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Traditional Background Vibe */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" 
                 style={{ backgroundImage: "url('/assets/adinkra_pattern.png')", backgroundSize: "200px" }} />
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                 style={{ backgroundImage: "url('/assets/backgrounds/bg_ghana_gold_adinkra.png')", backgroundSize: "cover", backgroundPosition: "center" }} />
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <motion.div
                    animate={{ boxShadow: ["0 0 0px 0px rgba(251,191,36,0.0)", "0 0 16px 4px rgba(251,191,36,0.35)", "0 0 0px 0px rgba(251,191,36,0.0)"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden bg-[#2a2a3a]"
                    style={{ background: "linear-gradient(135deg,#92400e 0%,#b45309 25%,#7c3aed 65%,#4f46e5 100%)" }}
                  >
                    <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
                  </motion.div>
                  <motion.span
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2"
                    style={{ borderColor: "#0f0f1a" }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-black text-sm tracking-tight">Ama</p>
                    <motion.span
                      animate={{ rotate: [0, 20, -20, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                      className="text-xs"
                    >✨</motion.span>
                  </div>
                  <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online · AI Assistant</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSpeaking(!isSpeaking)}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                  isSpeaking ? "text-amber-500 bg-amber-500/10" : "text-white/20 hover:text-white/40"
                )}
                title={isSpeaking ? "Mute Ama" : "Unmute Ama"}
              >
                {isSpeaking ? (
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <Volume2 className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className={cn("flex gap-2", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {/* Avatar dot */}
                  {m.role === "bot" && (
                    <div
                      className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center overflow-hidden self-end mb-4 bg-[#2a2a3a]"
                    style={{ background: "linear-gradient(135deg,#92400e,#7c3aed)" }}
                  >
                    <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
                  </div>
                  )}

                  <div className={cn("flex flex-col gap-1 max-w-[78%]", m.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn("px-4 py-2.5 rounded-2xl text-sm leading-relaxed font-medium",
                        m.role === "user"
                          ? "text-white rounded-tr-sm"
                          : "text-slate-200 rounded-tl-sm"
                      )}
                      style={m.role === "user"
                        ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {m.text}
                    </div>
                    <p className="text-[9px] text-white/20 px-1">{fmt(m.ts)}</p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center overflow-hidden bg-[#2a2a3a]"
                      style={{ background: "linear-gradient(135deg,#92400e,#7c3aed)" }}
                    >
                      <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
                    </div>
                    <div
                      className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {[0, 0.18, 0.36].map((delay, i) => (
                        <motion.span
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay, ease: "easeInOut" }}
                          className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* Quick actions */}
            <div
              className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              {QUICK_ACTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  disabled={typing}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all
                             text-indigo-300 hover:text-white disabled:opacity-40"
                  style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div
              className="px-4 pb-5 pt-3 shrink-0"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
                  placeholder="Ask Ama anything…"
                  disabled={typing}
                  className="flex-1 bg-white/5 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white
                             placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50
                             transition-all disabled:opacity-50"
                />
                
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleVoice}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                    isListening ? "bg-red-500 text-white animate-pulse" : "bg-white/5 text-white/40 hover:text-white"
                  )}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => send(input)}
                  disabled={!input.trim() || typing}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
                             disabled:opacity-30 transition-all"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                <Sparkles className="w-2.5 h-2.5 text-white/20" />
                <p className="text-[9px] text-white/20 font-medium tracking-wide">🌺 Ama · Powered by SwiftData AI</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
       {/* ── Trigger button ── */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(o => !o)}
        className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-2xl border-2 border-amber-500/20 overflow-hidden bg-[#1a1a2e]"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              className="z-10 bg-black/40 w-full h-full flex items-center justify-center"
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div key="open"
              initial={{ rotate: 30, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: -30, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread badge */}
        <AnimatePresence>
          {unread > 0 && !open && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center"
            >
              {unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}

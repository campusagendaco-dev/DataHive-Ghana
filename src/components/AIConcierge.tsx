import { useState, useEffect, useRef, useCallback } from "react";
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

// ─── Sub-components defined OUTSIDE AIConcierge ───────────────────────────────
// Critical: must be top-level so React doesn't remount on every parent render.

interface HeaderProps {
  isMobile: boolean;
  isSpeaking: boolean;
  onToggleSpeak: () => void;
  onClose: () => void;
}
function ChatHeader({ isMobile, isSpeaking, onToggleSpeak, onClose }: HeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <motion.div
            animate={{ boxShadow: ["0 0 0px 0px rgba(251,191,36,0)", "0 0 16px 4px rgba(251,191,36,0.35)", "0 0 0px 0px rgba(251,191,36,0)"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-11 h-11 rounded-2xl overflow-hidden"
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

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleSpeak}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            isSpeaking ? "text-amber-500 bg-amber-500/10" : "text-white/20 hover:text-white/40"
          )}
          title={isSpeaking ? "Mute Ama" : "Unmute Ama"}
        >
          {isSpeaking
            ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}><Volume2 className="w-4 h-4" /></motion.div>
            : <VolumeX className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/5 transition-all"
          title="Close"
        >
          {isMobile ? <X className="w-5 h-5" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: Message[];
  typing: boolean;
  bottomRef: React.RefObject<HTMLDivElement>;
}
function MessageList({ messages, typing, bottomRef }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none overscroll-contain">
      {messages.map((m, i) => (
        <motion.div
          key={m.id ?? i}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn("flex gap-2 items-end", m.role === "user" ? "flex-row-reverse" : "flex-row")}
        >
          {m.role === "bot" && (
            <div
              className="w-7 h-7 rounded-xl shrink-0 overflow-hidden mb-4"
              style={{ background: "linear-gradient(135deg,#92400e,#7c3aed)" }}
            >
              <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
            </div>
          )}
          <div className={cn("flex flex-col gap-1 max-w-[80%]", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                m.role === "user"
                  ? "text-white font-medium rounded-br-sm"
                  : "text-slate-200 rounded-bl-sm"
              )}
              style={m.role === "user"
                ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }
                : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }
              }
            >
              {m.text}
            </div>
            <p className="text-[9px] text-white/20 px-1 font-medium">{fmt(m.ts)}</p>
          </div>
        </motion.div>
      ))}

      {/* Typing indicator */}
      <AnimatePresence>
        {typing && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex items-end gap-2"
          >
            <div className="w-7 h-7 rounded-xl shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,#92400e,#7c3aed)" }}>
              <img src="/assets/ama_avatar.png" alt="Ama" className="w-full h-full object-cover object-top scale-[1.6]" />
            </div>
            <div
              className="px-4 py-3.5 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {[0, 0.15, 0.3].map((delay, idx) => (
                <motion.span
                  key={idx}
                  animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay, ease: "easeInOut" }}
                  className="w-2 h-2 rounded-full bg-indigo-400"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} className="h-1" />
    </div>
  );
}

interface QuickBarProps {
  onSend: (t: string) => void;
  disabled: boolean;
}
function QuickBar({ onSend, disabled }: QuickBarProps) {
  return (
    <div
      className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      {QUICK_ACTIONS.map(q => (
        <button
          key={q}
          type="button"
          onClick={() => onSend(q)}
          disabled={disabled}
          className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all
                     text-indigo-300 hover:text-white disabled:opacity-30 active:scale-95"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

interface InputBarProps {
  input: string;
  setInput: (v: string) => void;
  onSend: (t: string) => void;
  isListening: boolean;
  onToggleVoice: () => void;
  typing: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}
function InputBar({ input, setInput, onSend, isListening, onToggleVoice, typing, inputRef }: InputBarProps) {
  const hasText = input.trim().length > 0;

  return (
    <div
      className="px-4 pt-3 pb-4 shrink-0"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Text field */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(input);
              }
            }}
            placeholder="Ask Ama anything…"
            disabled={typing}
            autoComplete="off"
            autoCorrect="on"
            enterKeyHint="send"
            className="w-full bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white
                       placeholder:text-white/25 focus:outline-none focus:border-indigo-500/60 focus:bg-white/[0.09]
                       transition-all duration-200 disabled:opacity-40"
          />
          {/* Char count when long */}
          {input.length > 60 && (
            <span className="absolute right-3 bottom-1.5 text-[9px] text-white/20 font-mono">
              {input.length}
            </span>
          )}
        </div>

        {/* Mic / Send — morphs based on input */}
        <AnimatePresence mode="wait">
          {!hasText ? (
            <motion.button
              key="mic"
              type="button"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              whileTap={{ scale: 0.88 }}
              onClick={onToggleVoice}
              disabled={typing}
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-30",
                isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/40"
                  : "bg-white/8 text-white/50 hover:text-white hover:bg-white/12"
              )}
            >
              <AnimatePresence mode="wait">
                {isListening ? (
                  <motion.div key="off" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <MicOff className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div key="on" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <Mic className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="button"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              whileTap={{ scale: 0.88 }}
              onClick={() => onSend(input)}
              disabled={typing}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-30 shadow-lg shadow-indigo-500/30"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              <Send className="w-5 h-5 text-white" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <Sparkles className="w-2.5 h-2.5 text-white/15" />
        <p className="text-[9px] text-white/15 font-medium tracking-wide">🌺 Ama · Powered by SwiftData AI</p>
      </div>
    </div>
  );
}

// ─── Trigger button ───────────────────────────────────────────────────────────
function TriggerButton({ open, unread, onToggle }: { open: boolean; unread: number; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onToggle}
      className="relative w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-2xl border-2 border-amber-500/20 overflow-hidden bg-[#1a1a2e]"
      style={{ boxShadow: "0 8px 32px rgba(99,102,241,0.4)" }}
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
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AIConcierge() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [unread, setUnread]     = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(true);
  const [isMobile, setIsMobile]       = useState(false);
  const [kbOffset, setKbOffset]       = useState(0); // keyboard push offset in px

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const openRef        = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Mobile keyboard push (visualViewport) ─────────────────────────────────
  useEffect(() => {
    if (!isMobile || !open) { setKbOffset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbOffset(offset);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbOffset(0);
    };
  }, [isMobile, open]);

  // ── Lock body scroll on mobile ────────────────────────────────────────────
  useEffect(() => {
    if (isMobile) document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  // ── Auto scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── Load chat history ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const { data: history, error } = await supabase
          .from("chat_messages").select("*")
          .order("created_at", { ascending: true }).limit(20);
        if (error) throw error;
        if (history && history.length > 0) {
          setMessages(history.map(m => ({ id: m.id, role: m.role as any, text: m.content, ts: new Date(m.created_at) })));
        }
      } catch (err) {
        console.warn("[AIConcierge] Could not load chat history:", err);
      }
    };
    load();
  }, []);

  // ── Focus input when opened ───────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setUnread(0);
      // Small delay lets the sheet animation settle before focusing
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || typing) return;
    setInput("");

    const { data: { user } } = await supabase.auth.getUser();
    setMessages(prev => [...prev, { role: "user", text: msg, ts: new Date() }]);
    setTyping(true);
    // Re-focus input immediately after clearing so keyboard stays open on mobile
    setTimeout(() => inputRef.current?.focus(), 0);

    try {
      if (user) {
        supabase.from("chat_messages")
          .insert({ user_id: user.id, role: "user", content: msg })
          .then(({ error }) => { if (error) console.warn("[AIConcierge] save user msg:", error); });
      }

      const [profile, wallet, orders] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user?.id).maybeSingle(),
        supabase.from("wallets").select("balance").eq("agent_id", user?.id).maybeSingle(),
        supabase.from("orders").select("*").eq("agent_id", user?.id)
          .order("created_at", { ascending: false }).limit(3),
      ]);

      if (profile.data && wallet.data) {
        profile.data.wallet_balance = wallet.data.balance;
      }

      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.text }));
      const { data } = await supabase.functions.invoke("oracle-ai", {
        body: { context: { userMessage: msg, currentPath: window.location.pathname, profile: profile.data, recentOrders: orders.data }, history },
      });

      const reply = data?.oracle_opinion || "I'm here to help! Please try again.";
      setMessages(prev => [...prev, { role: "bot", text: reply, ts: new Date() }]);

      if (isSpeaking) {
        const u = new SpeechSynthesisUtterance(reply);
        u.lang = "en-GH"; u.pitch = 1.3; u.rate = 1.05;
        window.speechSynthesis.speak(u);
      }

      if (user) {
        supabase.from("chat_messages")
          .insert({ user_id: user.id, role: "bot", content: reply })
          .then(({ error }) => { if (error) console.warn("[AIConcierge] save bot reply:", error); });
      }

      if (!openRef.current) setUnread(n => n + 1);
    } catch {
      setMessages(prev => [...prev, { role: "bot", text: "Connection issue — please try again in a moment! 😊", ts: new Date() }]);
    } finally {
      setTyping(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing, isSpeaking, messages]);

  // ── Voice input ───────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported in this browser! 😊"); return; }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-GH";
    rec.onstart  = () => setIsListening(true);
    rec.onend    = () => setIsListening(false);
    rec.onerror  = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      // Auto-send voice input
      send(transcript);
    };
    recognitionRef.current = rec;
    rec.start();
  }, [isListening, send]);

  const panelBg = "linear-gradient(160deg,rgba(15,15,26,0.97) 0%,rgba(10,10,18,0.99) 60%,#080810 100%)";

  const sharedPanel = (
    <>
      <ChatHeader
        isMobile={isMobile}
        isSpeaking={isSpeaking}
        onToggleSpeak={() => setIsSpeaking(s => !s)}
        onClose={() => setOpen(false)}
      />
      <MessageList messages={messages} typing={typing} bottomRef={bottomRef} />
      <QuickBar onSend={send} disabled={typing} />
      <InputBar
        input={input}
        setInput={setInput}
        onSend={send}
        isListening={isListening}
        onToggleVoice={toggleVoice}
        typing={typing}
        inputRef={inputRef}
      />
    </>
  );

  return (
    <>
      {/* ── Mobile: bottom sheet ─────────────────────────────────────────── */}
      {isMobile && (
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
              />
              <motion.div
                key="sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 36 }}
                className="fixed inset-x-0 z-[9999] flex flex-col rounded-t-[28px] overflow-hidden"
                style={{
                  bottom: kbOffset,
                  height: `calc(92dvh - ${kbOffset}px)`,
                  background: panelBg,
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 -24px 60px rgba(0,0,0,0.7)",
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/15" />
                </div>
                {/* Adinkra watermark */}
                <div
                  className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{ backgroundImage: "url('/assets/adinkra_pattern.png')", backgroundSize: "200px" }}
                />
                {sharedPanel}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* ── Desktop: draggable floating panel ────────────────────────────── */}
      {!isMobile && (
        <motion.div
          drag dragMomentum={false} whileDrag={{ scale: 1.03, cursor: "grabbing" }}
          className="fixed bottom-10 right-10 z-[9999] flex flex-col items-end gap-3 cursor-grab"
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="w-[360px] sm:w-[400px] flex flex-col rounded-[28px] overflow-hidden"
                style={{
                  height: "min(580px, 88dvh)",
                  background: panelBg,
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                  style={{ backgroundImage: "url('/assets/adinkra_pattern.png')", backgroundSize: "200px" }}
                />
                {sharedPanel}
              </motion.div>
            )}
          </AnimatePresence>
          <TriggerButton open={open} unread={unread} onToggle={() => setOpen(o => !o)} />
        </motion.div>
      )}

      {/* ── Mobile trigger (only when closed) ────────────────────────────── */}
      {isMobile && !open && (
        <div className="fixed bottom-6 right-4 z-[9997]">
          <TriggerButton open={open} unread={unread} onToggle={() => setOpen(o => !o)} />
        </div>
      )}
    </>
  );
}

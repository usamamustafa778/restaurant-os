import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { sendStorefrontChatMessage } from "../../lib/api";

const SESSION_KEY = (slug) => `eatsdesk_agent_chat_${slug}`;

export default function StorefrontChatWidget({
  slug,
  primaryColor = "#EF4444",
  assistantName = "Assistant",
  welcomeMessage = "Hi! How can we help you today?",
  enabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !slug) return;
    let sid = window.sessionStorage.getItem(SESSION_KEY(slug));
    if (!sid) {
      sid = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      window.sessionStorage.setItem(SESSION_KEY(slug), sid);
    }
    setSessionId(sid);
  }, [slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const seedWelcome = useCallback(() => {
    setMessages([{ role: "assistant", content: welcomeMessage }]);
  }, [welcomeMessage]);

  useEffect(() => {
    if (open && messages.length === 0) seedWelcome();
  }, [open, messages.length, seedWelcome]);

  if (!enabled || !slug) return null;

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await sendStorefrontChatMessage(slug, {
        message: text,
        sessionId,
      });
      if (res.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(SESSION_KEY(slug), res.sessionId);
        }
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply || "Thanks for your message!" },
      ]);
    } catch (err) {
      setError(err.message || "Could not send message");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Sorry — we couldn’t reach the assistant right now. Please try again or call the restaurant.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl text-white transition hover:scale-105 focus:outline-none focus:ring-4 focus:ring-black/10"
        style={{ backgroundColor: primaryColor }}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[100] flex w-[min(100vw-2rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[min(70vh,520px)]">
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <div>
              <p className="font-bold text-sm">{assistantName}</p>
              <p className="text-xs text-white/90">We typically reply instantly</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50 min-h-[200px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-800 text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-3 py-2 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="px-3 text-xs text-red-600 bg-red-50 border-t border-red-100 py-1">{error}</p>
          )}

          <form onSubmit={handleSend} className="border-t border-slate-200 p-2 flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              disabled={sending}
              maxLength={4000}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

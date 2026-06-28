"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConvMessage {
  role: "user" | "assistant";
  content: string;
}

export function YardAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conv, setConv] = useState<ConvMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newConv: ConvMessage[] = [...conv, { role: "user", content: text }];

    setMessages((prev) => [...prev, userMessage]);
    setConv(newConv);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newConv }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Assistant error");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const assistantMessage: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => [...prev, assistantMessage]);
      setConv([...newConv, { role: "assistant", content: data.answer }]);
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = [
    "What products are low on stock?",
    "How many cedar pickets do we have on hand?",
    "Show me recent activity",
    "What went out on the last job?",
  ];

  return (
    <div className="flex flex-col h-[600px] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center text-orange-400">
          🤖
        </div>
        <div>
          <div className="font-semibold text-white text-sm">Yard Assistant</div>
          <div className="text-xs text-slate-500">Read-only · Powered by Claude</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🔥</div>
            <p className="text-slate-400 text-sm mb-6">
              Ask me about inventory, bundles, jobs, or low stock.
              I can only read data — changes go through the scan flow.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-orange-500 text-white"
                : "bg-slate-800 text-slate-100"
            }`}>
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl px-4 py-3 text-slate-400 text-sm">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about inventory…"
            disabled={loading}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2">Read-only assistant — inventory changes require the scan flow</p>
      </div>
    </div>
  );
}

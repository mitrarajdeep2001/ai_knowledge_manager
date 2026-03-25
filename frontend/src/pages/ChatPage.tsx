import { useEffect, useState, useRef, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  Loader2,
  Brain,
  Sparkles,
  X,
  ChevronDown,
} from "lucide-react";
import { chatAPI, notesAPI, documentsAPI } from "../services/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import clsx from "clsx";

interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Session {
  id: string;
  title: string;
  updatedAt: string;
}

type ScopeType = "all" | "note" | "document";

interface ScopeOption {
  id: string;
  title: string;
}

function MessageBubble({
  msg,
  isTyping,
}: {
  msg: Message;
  isTyping?: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div
      className={clsx(
        "flex items-end gap-3 animate-fadeIn",
        isUser && "flex-row-reverse",
      )}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
        style={{ background: isUser ? 'var(--bg-tertiary)' : 'var(--gradient-primary)' }}
      >
        {isUser ? (
          <span style={{ color: 'var(--text-secondary)' }}>U</span>
        ) : (
          <Brain className="w-4 h-4 text-white" />
        )}
      </div>

      <div
        className={clsx(
          "max-w-[85%] space-y-2",
          isUser && "items-end flex flex-col",
        )}
      >
        <div
          className="rounded-2xl px-4 py-3"
          style={
            isUser
              ? { background: 'var(--gradient-primary)', color: 'white' }
              : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }
          }
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          ) : (
            <div className="prose-dark text-sm overflow-hidden min-h-[1.5rem]">
              <div className={clsx("markdown-wrapper", isTyping && "typing")}>
                {msg.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  isTyping && <div className="h-5" />
                )}
                {isTyping && (
                  <span className="cursor" style={{ color: 'var(--accent-primary)' }}>
                    |
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");

  const [availableNotes, setAvailableNotes] = useState<ScopeOption[]>([]);
  const [availableDocs, setAvailableDocs] = useState<ScopeOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([notesAPI.list({ limit: 100 }), documentsAPI.list()])
      .then(([notesRes, docsRes]) => {
        const notesList = Array.isArray(notesRes.data)
          ? notesRes.data
          : notesRes.data?.data || [];
        setAvailableNotes(
          notesList.map((n: any) => ({ id: n.id, title: n.title })),
        );

        const docsList = Array.isArray(docsRes.data)
          ? docsRes.data
          : docsRes.data?.data || [];
        setAvailableDocs(
          docsList.map((d: any) => ({ id: d.id, title: d.filename })),
        );
      })
      .catch(console.error)
      .finally(() => setLoadingOptions(false));

    chatAPI
      .listSessions()
      .then((res) => setSessions(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const loadSession = useCallback(async (sessionId: string) => {
    setLoadingMsgs(true);
    setActiveSession(sessionId);
    try {
      const r = await chatAPI.getSessionMessages(sessionId);
      setMessages(r.data || []);
    } catch {
      toast.error("Failed to load session messages");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const createNewSession = async () => {
    setActiveSession(null);
    setMessages([]);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content) return;

    if (scopeType !== "all" && !selectedScopeId) {
      toast.error(`Please select a ${scopeType} to chat with.`);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setInput("");
    setSending(true);
    setIsTyping(true);

    const userMsgId = crypto.randomUUID();
    const tempUserMsg: Message = {
      id: userMsgId,
      sessionId: activeSession || "",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const assistantMsgId = crypto.randomUUID();
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      sessionId: activeSession || "",
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg, initialAssistantMsg]);

    const scopePayload =
      scopeType === "all"
        ? { type: "all" }
        : { type: scopeType, ids: [selectedScopeId] };

    let accumulated = "";
    let framePending = false;

    await chatAPI.streamMessage(
      {
        message: content,
        sessionId: activeSession || undefined,
        scope: scopePayload,
      },
      {
        onToken: (token) => {
          accumulated += token;

          if (!framePending) {
            framePending = true;
            requestAnimationFrame(() => {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulated }
                    : msg,
                ),
              );

              if (bottomRef.current) {
                bottomRef.current.scrollIntoView({ behavior: "smooth" });
              }

              framePending = false;
            });
          }
        },
        onSessionId: (newSessionId) => {
          setActiveSession(newSessionId);

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMsgId || msg.id === assistantMsgId
                ? { ...msg, sessionId: newSessionId }
                : msg,
            ),
          );

          setSessions((prev) => {
            const exists = prev.find((s) => s.id === newSessionId);
            if (exists) return prev;

            return [
              {
                id: newSessionId,
                title:
                  content.slice(0, 30) + (content.length > 30 ? "..." : ""),
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ];
          });
        },
        onError: (err) => {
          toast.error(err);
        },
        onDone: () => {
          setSending(false);
          setIsTyping(false);
        },
      },
      controller.signal,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const starterPrompts = [
    "What are the main topics in my knowledge base?",
    "Summarize everything I know about AI",
    "What have I been learning recently?",
    "Find connections between my notes",
  ];

  return (
    <div className="flex h-full">
      {/* Sessions Sidebar */}
      <div 
        className="w-72 flex flex-col shrink-0"
        style={{ 
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)'
        }}
      >
        <div 
          className="p-4"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <button
            onClick={createNewSession}
            className="btn-primary w-full justify-center text-sm"
          >
            <Plus className="w-4 h-4 shrink-0" /> New Chat
          </button>
        </div>
        <div 
          className="p-4 space-y-3"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Chat Scope</h3>
          </div>

          <div 
            className="flex rounded-xl overflow-hidden p-0.5"
            style={{ 
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)'
            }}
          >
            {(["all", "note", "document"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setScopeType(type);
                  setSelectedScopeId("");
                }}
                className={clsx(
                  "flex-1 text-xs py-2 px-3 rounded-lg font-medium capitalize transition-all",
                  scopeType === type
                    ? "text-white"
                    : "",
                )}
                style={scopeType === type ? { background: 'var(--gradient-primary)' } : { color: 'var(--text-muted)' }}
              >
                {type}
              </button>
            ))}
          </div>

          {scopeType === "note" && (
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Select Note</label>
              <div className="relative">
                <select
                  className="input py-2 text-sm appearance-none cursor-pointer"
                  value={selectedScopeId}
                  onChange={(e) => setSelectedScopeId(e.target.value)}
                  disabled={loadingOptions || sending}
                >
                  <option value="" disabled>
                    Choose a note...
                  </option>
                  {availableNotes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          {scopeType === "document" && (
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Select Document</label>
              <div className="relative">
                <select
                  className="input py-2 text-sm appearance-none cursor-pointer"
                  value={selectedScopeId}
                  onChange={(e) => setSelectedScopeId(e.target.value)}
                  disabled={loadingOptions || sending}
                >
                  <option value="" disabled>
                    Choose a document...
                  </option>
                  {availableDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: 'var(--text-faint)' }}>
            Recent Sessions
          </h3>
          {sessions.length === 0 ? (
            <p className="text-xs px-2 italic" style={{ color: 'var(--text-faint)' }}>
              No local sessions
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session.id)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all"
                style={
                  activeSession === session.id
                    ? { 
                        backgroundColor: 'var(--accent-glow)', 
                        color: 'var(--accent-primary)',
                        border: '1px solid var(--border-accent)'
                      }
                    : { color: 'var(--text-muted)' }
                }
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="text-sm flex-1 truncate">{session.title}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <div 
          className="flex items-center gap-3 px-6 py-4 shrink-0"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-primary)'
          }}
        >
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Knowledge Chat
            </h1>
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>Scope:</span>
              <span 
                className="px-2 py-0.5 rounded font-medium capitalize"
                style={{ 
                  backgroundColor: 'var(--accent-glow)',
                  color: 'var(--accent-primary)',
                  border: '1px solid var(--border-accent)'
                }}
              >
                {scopeType === "all" ? "Entire Knowledge Base" : scopeType}
              </span>
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scroll-smooth">
          {loadingMsgs ? (
            <div className="flex justify-center h-full items-center">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fadeIn max-w-2xl mx-auto">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                style={{ 
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--border-accent)'
                }}
              >
                <Brain className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
              </div>
              <h2 className="text-2xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Chat with your Knowledge
              </h2>
              <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Ask anything about your notes and documents. The AI uses RAG to
                find relevant context from your knowledge base and generates an
                answer strictly based on your data.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full">
                {starterPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setInput(p);
                      inputRef.current?.focus();
                    }}
                    className="text-left p-4 rounded-2xl transition-all shadow-sm"
                    style={{ 
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isTyping={
                    sending &&
                    idx === messages.length - 1 &&
                    msg.role === "assistant"
                  }
                />
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs animate-pulse font-medium ml-11" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex gap-1">
                    <span
                      className="w-1 h-1 rounded-full animate-bounce"
                      style={{ backgroundColor: 'var(--text-muted)', animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1 h-1 rounded-full animate-bounce"
                      style={{ backgroundColor: 'var(--text-muted)', animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1 h-1 rounded-full animate-bounce"
                      style={{ backgroundColor: 'var(--text-muted)', animationDelay: "300ms" }}
                    />
                  </div>
                  AI is typing...
                </div>
              )}
              <div ref={bottomRef} className="h-4" />
            </>
          )}
        </div>

        {/* Input Area */}
        <div 
          className="p-4 shrink-0"
          style={{ 
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)'
          }}
        >
          <div className="max-w-4xl mx-auto relative group">
            <div 
              className="absolute -inset-0.5 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"
              style={{ background: 'var(--gradient-primary)' }}
            />
            <div 
              className="relative flex items-end gap-3 rounded-2xl p-2 transition-all shadow-lg"
              style={{ 
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  scopeType === "all"
                    ? "Ask anything about your knowledge base..."
                    : `Ask about this ${scopeType}...`
                }
                className="flex-1 bg-transparent resize-none outline-none text-base leading-relaxed max-h-48 py-2 px-4"
                style={{ height: "auto", color: 'var(--text-primary)' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }}
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="w-10 h-10 mb-1 mr-1 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0 shadow-md"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Send className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
            AI can make mistakes. Check your original notes for accuracy.
          </p>
        </div>
      </div>
    </div>
  );
}

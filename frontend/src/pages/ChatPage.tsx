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
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
          isUser
            ? "bg-gradient-to-br from-gray-600 to-gray-800 text-gray-200"
            : "bg-gradient-to-br from-brand-600 to-purple-600",
        )}
      >
        {isUser ? "U" : <Brain className="w-4 h-4 text-white" />}
      </div>

      <div
        className={clsx(
          "max-w-[85%] space-y-2",
          isUser && "items-end flex flex-col",
        )}
      >
        <div
          className={clsx(
            "rounded-2xl px-4 py-2",
            isUser
              ? "bg-brand-600 text-white rounded-br-none"
              : "bg-gray-800 border border-gray-700 rounded-bl-none text-gray-100",
          )}
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
                  isTyping && <div className="h-5" /> // Spacer for the cursor
                )}
                {isTyping && (
                  <span className="cursor text-brand-400 font-bold ml-1">
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
  // Session State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  // Message State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Scope State
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");

  // Available items for scope selector
  const [availableNotes, setAvailableNotes] = useState<ScopeOption[]>([]);
  const [availableDocs, setAvailableDocs] = useState<ScopeOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch items for scope dropdowns and user sessions
  useEffect(() => {
    // Fetch scope items
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

    // Fetch user sessions
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

    // Validate scope
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
      content: "", // Will be filled by streaming
      createdAt: new Date().toISOString(),
    };

    // Replace assistant response if we are canceling an in-progress generation?
    // Not explicitly requested, standard append is fine.
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
      <div className="w-72 border-r border-gray-800 bg-gray-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={createNewSession}
            className="btn-primary w-full justify-center text-sm"
          >
            <Plus className="w-4 h-4 shrink-0" /> New Chat
          </button>
        </div>
        <div className="p-4 border-b border-gray-800 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-medium text-gray-200">Chat Scope</h3>
          </div>

          <div className="flex rounded-lg overflow-hidden border border-gray-700 p-0.5 bg-gray-900/50">
            {(["all", "note", "document"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setScopeType(type);
                  setSelectedScopeId("");
                }}
                className={clsx(
                  "flex-1 text-xs py-1.5 px-2 rounded-md font-medium capitalize transition-all",
                  scopeType === type
                    ? "bg-brand-600 text-white shadow"
                    : "text-gray-400 hover:text-gray-200",
                )}
              >
                {type}
              </button>
            ))}
          </div>

          {scopeType === "note" && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Select Note</label>
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
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          {scopeType === "document" && (
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Select Document</label>
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
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
            Recent Sessions
          </h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-600 px-2 italic">
              No local sessions
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group transition-all",
                  activeSession === session.id
                    ? "bg-brand-900/30 border border-brand-800/50 text-brand-300"
                    : "hover:bg-gray-800 text-gray-400",
                )}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="text-sm flex-1 truncate">{session.title}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-950">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-gray-900/30 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">
              AI Knowledge Chat
            </h1>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <span>Scope:</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-brand-300 font-medium capitalize border border-brand-900/50">
                {scopeType === "all" ? "Entire Knowledge Base" : scopeType}
              </span>
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scroll-smooth">
          {loadingMsgs ? (
            <div className="flex justify-center h-full items-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fadeIn max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600/20 to-purple-600/20 border border-brand-800/30 flex items-center justify-center mb-6">
                <Brain className="w-8 h-8 text-brand-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Chat with your Knowledge
              </h2>
              <p className="text-gray-400 text-base mb-8 leading-relaxed">
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
                    className="text-left p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-brand-700/50 hover:bg-gray-800 text-sm text-gray-300 hover:text-white transition-all shadow-sm"
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
                <div className="flex items-center gap-2 text-gray-500 text-xs animate-pulse font-medium ml-11">
                  <div className="flex gap-1">
                    <span
                      className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></span>
                    <span
                      className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></span>
                    <span
                      className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></span>
                  </div>
                  AI is typing...
                </div>
              )}
              <div ref={bottomRef} className="h-4" />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-900/30 border-t border-gray-800 shrink-0">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-600/30 to-purple-600/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <div className="relative flex items-end gap-3 bg-gray-900 border border-gray-700/80 rounded-2xl p-2 focus-within:border-brand-600 transition-all shadow-lg">
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
                className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 resize-none outline-none text-base leading-relaxed max-h-48 py-2 px-3 pl-4"
                style={{ height: "auto" }}
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
                className="w-10 h-10 mb-1 mr-1 rounded-xl bg-gradient-to-br from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0 shadow-md"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Send className="w-5 h-5 text-white ml-0.5" />
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">
            AI can make mistakes. Check your original notes for accuracy.
          </p>
        </div>
      </div>
    </div>
  );
}

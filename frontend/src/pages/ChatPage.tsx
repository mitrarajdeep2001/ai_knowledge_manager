import { useEffect, useState, useRef, useCallback } from 'react'
import {
  MessageSquare, Plus, Send, Loader2, Brain,
  Trash2, FileText, Upload, ChevronRight, X, Sparkles
} from 'lucide-react'
import { chatAPI } from '../services/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

interface Message {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  sources: Array<{ id: number; type: string; title: string; score: number; content_preview: string }>
  created_at: string
}

interface Session {
  id: number
  title: string
  created_at: string
  updated_at: string
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-fadeIn">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center shrink-0">
        <Brain className="w-4 h-4 text-white" />
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
      </div>
    </div>
  )
}

function SourceCard({ source }: { source: any }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="text-xs border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/60 hover:bg-gray-800 transition-colors text-left"
      >
        {source.type === 'note' 
          ? <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          : <Upload className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        }
        <span className="text-gray-400 truncate flex-1">{source.title}</span>
        <span className="text-gray-600 shrink-0">{(source.score * 100).toFixed(0)}%</span>
        <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 py-2 text-gray-500 bg-gray-900/50 border-t border-gray-700">
          {source.content_preview}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={clsx('flex items-end gap-3 animate-fadeIn', isUser && 'flex-row-reverse')}>
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
        isUser
          ? 'bg-gradient-to-br from-gray-600 to-gray-800 text-gray-200'
          : 'bg-gradient-to-br from-brand-600 to-purple-600'
      )}>
        {isUser ? 'U' : <Brain className="w-4 h-4 text-white" />}
      </div>

      <div className={clsx('max-w-[75%] space-y-2', isUser && 'items-end flex flex-col')}>
        <div className={clsx(
          'rounded-2xl px-4 py-3',
          isUser
            ? 'bg-brand-600 text-white rounded-br-none'
            : 'bg-gray-800 border border-gray-700 rounded-bl-none text-gray-100'
        )}>
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose-dark text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-xs text-gray-600 px-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Sources used:
            </p>
            {msg.sources.map((src, i) => (
              <SourceCard key={i} source={src} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    chatAPI.listSessions()
      .then((r) => setSessions(r.data))
      .catch(console.error)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const loadSession = useCallback(async (sessionId: number) => {
    setLoadingMsgs(true)
    setActiveSession(sessionId)
    try {
      const r = await chatAPI.getSession(sessionId)
      setMessages(r.data.messages || [])
    } catch {
      toast.error('Failed to load session')
    } finally {
      setLoadingMsgs(false)
    }
  }, [])

  const createNewSession = async () => {
    setActiveSession(null)
    setMessages([])
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || sending) return
    
    setInput('')
    setSending(true)
    
    // Optimistic user message
    const tempUserMsg: Message = {
      id: Date.now(),
      session_id: activeSession || 0,
      role: 'user',
      content,
      sources: [],
      created_at: new Date().toISOString()
    }
    setMessages((prev) => [...prev, tempUserMsg])
    setIsTyping(true)
    
    try {
      const r = await chatAPI.sendMessage({
        content,
        session_id: activeSession,
      })
      
      const { session_id, message } = r.data
      
      if (!activeSession) {
        setActiveSession(session_id)
        // Reload sessions
        const sessR = await chatAPI.listSessions()
        setSessions(sessR.data)
      } else {
        // Update session title if it changed
        setSessions((prev) =>
          prev.map((s) =>
            s.id === session_id
              ? { ...s, updated_at: new Date().toISOString() }
              : s
          )
        )
      }
      
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id)
        const userMsgConfirmed = { ...tempUserMsg, session_id }
        return [...withoutTemp, userMsgConfirmed, message]
      })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id))
    } finally {
      setSending(false)
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDeleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await chatAPI.deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSession === id) {
        setActiveSession(null)
        setMessages([])
      }
    } catch {
      toast.error('Delete failed')
    }
  }

  const starterPrompts = [
    'What are the main topics in my knowledge base?',
    'Summarize everything I know about AI',
    'What have I been learning recently?',
    'Find connections between my notes',
  ]

  return (
    <div className="flex h-full">
      {/* Sessions Sidebar */}
      <div className="w-64 border-r border-gray-800 bg-gray-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <button onClick={createNewSession} className="btn-primary w-full justify-center text-sm">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-xs text-gray-600 text-center mt-8">No chats yet</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer group transition-all',
                  activeSession === session.id
                    ? 'bg-brand-900/30 border border-brand-800/50 text-brand-300'
                    : 'hover:bg-gray-800 text-gray-400'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs flex-1 truncate">{session.title || 'New Chat'}</span>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Knowledge Chat</h1>
            <p className="text-xs text-gray-500">Ask questions about your notes & documents</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loadingMsgs ? (
            <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fadeIn">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-600/20 to-purple-600/20 border border-brand-800/30 flex items-center justify-center mb-4">
                <Brain className="w-10 h-10 text-brand-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Chat with your Knowledge</h2>
              <p className="text-gray-500 text-sm max-w-md mb-6">
                Ask anything about your notes and documents. The AI uses RAG to find relevant context from your knowledge base.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg w-full">
                {starterPrompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => { setInput(p); inputRef.current?.focus() }}
                    className="text-left p-3 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-brand-800/50 text-sm text-gray-400 hover:text-gray-200 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
              {isTyping && <TypingIndicator />}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-800 shrink-0">
          <div className="flex items-end gap-3 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 focus-within:border-brand-600 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask anything about your knowledge base..."
              className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 resize-none outline-none text-sm leading-relaxed max-h-40"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
          <p className="text-xs text-gray-700 mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

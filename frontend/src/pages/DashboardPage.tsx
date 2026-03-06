import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Upload, MessageSquare, HelpCircle, TrendingUp, Clock, Database, Zap } from 'lucide-react'
import { statsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'

interface Stats {
  total_notes: number
  total_documents: number
  total_chunks: number
  total_quizzes: number
  total_chat_sessions: number
  recent_activity: Array<{ id: number; title: string; type: string; updated_at: string }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    statsAPI.get()
      .then((r) => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    { label: 'Notes', value: stats?.total_notes ?? 0, icon: FileText, color: 'from-blue-600 to-blue-800', link: '/notes' },
    { label: 'Documents', value: stats?.total_documents ?? 0, icon: Upload, color: 'from-purple-600 to-purple-800', link: '/documents' },
    { label: 'Quizzes', value: stats?.total_quizzes ?? 0, icon: HelpCircle, color: 'from-green-600 to-green-800', link: '/quiz' },
    { label: 'Chat Sessions', value: stats?.total_chat_sessions ?? 0, icon: MessageSquare, color: 'from-orange-600 to-orange-800', link: '/chat' },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">
          Welcome back, <span className="text-brand-400">{user?.username}</span> 👋
        </h1>
        <p className="text-gray-500">Here's an overview of your knowledge base</p>
      </div>

      {/* Vector DB indicator */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-900/30 to-purple-900/20 border border-brand-800/30 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
          <Database className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-300">Vector Knowledge Base Active</p>
          <p className="text-xs text-gray-500">
            {stats?.total_chunks ?? 0} embeddings indexed with pgvector (768-dim) • Powered by Gemini text-embedding-004 (free)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
          <span className="text-xs text-green-400 font-medium">Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, link }) => (
          <Link key={label} to={link} className="card p-5 hover:border-gray-700 transition-all group">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            Recent Activity
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : stats?.recent_activity?.length ? (
            <div className="space-y-2">
              {stats.recent_activity.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={item.type === 'note' ? `/notes/${item.id}` : '/documents'}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    item.type === 'note' ? 'bg-blue-900/40' : 'bg-purple-900/40'
                  }`}>
                    {item.type === 'note'
                      ? <FileText className="w-4 h-4 text-blue-400" />
                      : <Upload className="w-4 h-4 text-purple-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.type} • {formatDistanceToNow(new Date(item.updated_at))} ago</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">No activity yet</p>
              <Link to="/notes" className="text-brand-400 text-sm hover:underline mt-1 inline-block">
                Create your first note →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: '/notes', icon: FileText, label: 'New Note', desc: 'Write & embed', color: 'blue' },
              { to: '/documents', icon: Upload, label: 'Upload Doc', desc: 'PDF, DOCX, TXT', color: 'purple' },
              { to: '/chat', icon: MessageSquare, label: 'AI Chat', desc: 'Ask your KB', color: 'orange' },
              { to: '/quiz', icon: HelpCircle, label: 'Take Quiz', desc: 'Test knowledge', color: 'green' },
            ].map(({ to, icon: Icon, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className="p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 transition-all group"
              >
                <Icon className={`w-6 h-6 mb-2 text-${color}-400 group-hover:scale-110 transition-transform`} />
                <p className="text-sm font-medium text-gray-200">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </Link>
            ))}
          </div>
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-brand-900/20 to-purple-900/10 border border-brand-800/20">
            <p className="text-xs text-gray-400 leading-relaxed">
              <span className="text-brand-300 font-medium">💡 How it works:</span> Your notes and documents are automatically converted into 768-dim vector embeddings using Google's <strong>text-embedding-004</strong> model (free), stored in pgvector, and queried with <strong>Gemini 1.5 Flash</strong> for RAG-powered chat.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

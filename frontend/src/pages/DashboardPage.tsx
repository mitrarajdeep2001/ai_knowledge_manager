import useSWR from 'swr'
import { Link } from 'react-router-dom'
import {
  FileText,
  Upload,
  MessageSquare,
  HelpCircle,
  Clock,
  Database,
  Zap,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { useAuthStore } from '../store/authStore'
import { dashboardAPI, type DashboardActivityItem, type DashboardData } from '../services/api'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function activityLink(item: DashboardActivityItem): string {
  switch (item.type) {
    case 'note':
      return `/notes/${item.id}`
    case 'document':
      return '/documents'
    case 'quiz':
      return '/quiz'
    case 'chat':
      return '/chat'
  }
}

function activityIcon(type: DashboardActivityItem['type']) {
  switch (type) {
    case 'note':
      return <FileText className="w-4 h-4 text-blue-400" />
    case 'document':
      return <Upload className="w-4 h-4 text-purple-400" />
    case 'quiz':
      return <HelpCircle className="w-4 h-4 text-green-400" />
    case 'chat':
      return <MessageSquare className="w-4 h-4 text-orange-400" />
  }
}

function activityIconBg(type: DashboardActivityItem['type']): string {
  switch (type) {
    case 'note':
      return 'bg-blue-900/40'
    case 'document':
      return 'bg-purple-900/40'
    case 'quiz':
      return 'bg-green-900/40'
    case 'chat':
      return 'bg-orange-900/40'
  }
}

// ── skeleton components ───────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-700 mb-3" />
      <div className="h-7 w-12 bg-gray-700 rounded mb-1" />
      <div className="h-4 w-20 bg-gray-800 rounded" />
    </div>
  )
}

function SkeletonActivity() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

const fetcher = () => dashboardAPI.get().then((r) => r.data)

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    '/dashboard',
    fetcher,
    { revalidateOnFocus: true },
  )

  if (error) {
    toast.error('Failed to load dashboard', { id: 'dashboard-error' })
  }

  const isEverythingEmpty =
    !isLoading &&
    data &&
    data.stats.notes === 0 &&
    data.stats.documents === 0 &&
    data.stats.quizzes === 0 &&
    data.stats.chatSessions === 0

  const statCards = [
    {
      label: 'Notes',
      value: data?.stats.notes ?? 0,
      icon: FileText,
      color: 'from-blue-600 to-blue-800',
      link: '/notes',
    },
    {
      label: 'Documents',
      value: data?.stats.documents ?? 0,
      icon: Upload,
      color: 'from-purple-600 to-purple-800',
      link: '/documents',
    },
    {
      label: 'Quizzes',
      value: data?.stats.quizzes ?? 0,
      icon: HelpCircle,
      color: 'from-green-600 to-green-800',
      link: '/quiz',
    },
    {
      label: 'Chat Sessions',
      value: data?.stats.chatSessions ?? 0,
      icon: MessageSquare,
      color: 'from-orange-600 to-orange-800',
      link: '/chat',
    },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Welcome back,{' '}
            <span className="text-brand-400">{user?.username}</span>
          </h1>
          <p className="text-gray-500">Here's an overview of your knowledge base</p>
        </div>
        {error && (
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-800/40 flex items-center gap-3 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load dashboard data. Please retry.
        </div>
      )}

      {/* Knowledge Base Banner */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-900/30 to-purple-900/20 border border-brand-800/30 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
          <Database className="w-5 h-5 text-brand-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-brand-300">Vector Knowledge Base Active</p>
          {isLoading ? (
            <div className="h-3 w-56 bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-xs text-gray-500">
              {formatCount(data?.knowledgeBase.embeddingsCount ?? 0)} embeddings indexed •{' '}
              {data?.knowledgeBase.embeddingModel} ({data?.knowledgeBase.dimension}-dim)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
          ) : data?.knowledgeBase.status === 'online' ? (
            <>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Online</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-gray-500 rounded-full" />
              <span className="text-xs text-gray-500 font-medium">Empty</span>
            </>
          )}
        </div>
      </div>

      {/* Empty state CTA */}
      {isEverythingEmpty && (
        <div className="mb-8 p-6 rounded-xl border border-dashed border-gray-700 text-center">
          <p className="text-gray-400 mb-3">Your knowledge base is empty.</p>
          <Link
            to="/notes"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            Create your first note
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
          : statCards.map(({ label, value, icon: Icon, color, link }) => (
              <Link
                key={label}
                to={link}
                className="card p-5 hover:border-gray-700 transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-white">{formatCount(value)}</p>
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

          {isLoading ? (
            <SkeletonActivity />
          ) : data?.recentActivity.length ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.recentActivity.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={activityLink(item)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${activityIconBg(item.type)}`}
                  >
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {item.type} •{' '}
                      {formatDistanceToNow(new Date(item.createdAt))} ago
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">No activity yet</p>
              <Link
                to="/notes"
                className="text-brand-400 text-sm hover:underline mt-1 inline-block"
              >
                Create your first note →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6 flex flex-col">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {[
              { to: '/notes', icon: FileText, label: 'New Note', desc: 'Write & embed', color: 'blue' },
              { to: '/documents', icon: Upload, label: 'Upload Document', desc: 'PDF, DOCX, TXT', color: 'purple' },
              { to: '/chat', icon: MessageSquare, label: 'AI Chat', desc: 'Ask your KB', color: 'orange' },
              { to: '/quiz', icon: HelpCircle, label: 'Take Quiz', desc: 'Test knowledge', color: 'green' },
            ].map(({ to, icon: Icon, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col justify-center p-4 rounded-xl bg-gray-800/60 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 transition-all group"
              >
                <Icon
                  className={`w-6 h-6 mb-2 text-${color}-400 group-hover:scale-110 transition-transform`}
                />
                <p className="text-sm font-medium text-gray-200">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const iconClass = 'w-4 h-4'
  switch (type) {
    case 'note':
      return <FileText className={iconClass} style={{ color: '#60a5fa' }} />
    case 'document':
      return <Upload className={iconClass} style={{ color: '#a78bfa' }} />
    case 'quiz':
      return <HelpCircle className={iconClass} style={{ color: '#4ade80' }} />
    case 'chat':
      return <MessageSquare className={iconClass} style={{ color: '#fb923c' }} />
  }
}

function activityIconBg(type: DashboardActivityItem['type']): React.CSSProperties {
  switch (type) {
    case 'note':
      return { backgroundColor: 'rgba(96, 165, 250, 0.15)' }
    case 'document':
      return { backgroundColor: 'rgba(167, 139, 250, 0.15)' }
    case 'quiz':
      return { backgroundColor: 'rgba(74, 222, 128, 0.15)' }
    case 'chat':
      return { backgroundColor: 'rgba(251, 146, 60, 0.15)' }
  }
}

function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="skeleton w-11 h-11 rounded-xl mb-3" />
      <div className="skeleton-text w-12 mb-2" />
      <div className="skeleton-text w-20" />
    </div>
  )
}

function SkeletonActivity() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="skeleton w-9 h-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-text w-3/4" />
            <div className="skeleton-text w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

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
      color: '#6366f1',
      bgGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      link: '/notes',
    },
    {
      label: 'Documents',
      value: data?.stats.documents ?? 0,
      icon: Upload,
      color: '#a855f7',
      bgGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
      link: '/documents',
    },
    {
      label: 'Quizzes',
      value: data?.stats.quizzes ?? 0,
      icon: HelpCircle,
      color: '#22c55e',
      bgGradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
      link: '/quiz',
    },
    {
      label: 'Chat Sessions',
      value: data?.stats.chatSessions ?? 0,
      icon: MessageSquare,
      color: '#f59e0b',
      bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
      link: '/chat',
    },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Welcome back,{' '}
            <span className="gradient-text">{user?.username}</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Here's an overview of your knowledge base
          </p>
        </div>
        {error && (
          <button
            onClick={() => mutate()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div 
          className="mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm"
          style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--error)'
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          Failed to load dashboard data. Please retry.
        </div>
      )}

      {/* Knowledge Base Banner */}
      <div 
        className="mb-6 p-5 rounded-2xl border"
        style={{ 
          background: 'linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%)',
          borderColor: 'var(--border-accent)'
        }}
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}
          >
            <Database className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
              Vector Knowledge Base Active
            </p>
            {isLoading ? (
              <div 
                className="h-3 w-56 rounded mt-1 animate-pulse"
                style={{ background: 'var(--bg-tertiary)' }}
              />
            ) : (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatCount(data?.knowledgeBase.embeddingsCount ?? 0)} embeddings indexed •{' '}
                {data?.knowledgeBase.embeddingModel} ({data?.knowledgeBase.dimension}-dim)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div 
                className="h-4 w-16 rounded animate-pulse"
                style={{ background: 'var(--bg-tertiary)' }}
              />
            ) : data?.knowledgeBase.status === 'online' ? (
              <>
                <span 
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--success)' }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                  Online
                </span>
              </>
            ) : (
              <>
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--text-faint)' }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Empty
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Empty state CTA */}
      {isEverythingEmpty && (
        <div 
          className="mb-8 p-6 rounded-2xl text-center"
          style={{ 
            border: '2px dashed var(--border-primary)',
          }}
        >
          <p className="mb-3" style={{ color: 'var(--text-muted)' }}>
            Your knowledge base is empty.
          </p>
          <Link
            to="/notes"
            className="btn-primary inline-flex items-center gap-2"
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
          : statCards.map(({ label, value, icon: Icon, bgGradient, color, link }) => (
              <Link
                key={label}
                to={link}
                className="card p-5 transition-all duration-200 group"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                  style={{ background: bgGradient }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {formatCount(value)}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </p>
              </Link>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Clock className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
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
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={activityIconBg(item.type)}
                  >
                    {activityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                      {item.type} • {formatDistanceToNow(new Date(item.createdAt))} ago
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>No activity yet</p>
              <Link
                to="/notes"
                className="text-sm mt-1 inline-block"
                style={{ color: 'var(--accent-primary)' }}
              >
                Create your first note →
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6 flex flex-col">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {[
              { to: '/notes', icon: FileText, label: 'New Note', desc: 'Write & embed', color: '#6366f1' },
              { to: '/documents', icon: Upload, label: 'Upload Document', desc: 'PDF, DOCX, TXT', color: '#a855f7' },
              { to: '/chat', icon: MessageSquare, label: 'AI Chat', desc: 'Ask your KB', color: '#f59e0b' },
              { to: '/quiz', icon: HelpCircle, label: 'Take Quiz', desc: 'Test knowledge', color: '#22c55e' },
            ].map(({ to, icon: Icon, label, desc, color }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col justify-center p-4 rounded-2xl border transition-all duration-200 group"
                style={{ 
                  backgroundColor: 'var(--bg-tertiary)',
                  borderColor: 'var(--border-primary)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Icon
                  className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform"
                  style={{ color }}
                />
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {label}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

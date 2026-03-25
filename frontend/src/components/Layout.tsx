import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Brain, LayoutDashboard, FileText, Upload,
  MessageSquare, HelpCircle, Search, LogOut,
  Zap, Sun, Moon
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/notes', icon: FileText, label: 'Notes' },
  { to: '/documents', icon: Upload, label: 'Documents' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/quiz', icon: HelpCircle, label: 'Quizzes' },
  { to: '/search', icon: Search, label: 'Search' },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside 
        className="w-64 flex flex-col shrink-0 border-r"
        style={{ 
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)'
        }}
      >
        {/* Logo */}
        <div 
          className="flex items-center justify-between gap-3 p-5 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>AI Knowledge</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manager</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all duration-200"
            style={{ 
              color: 'var(--text-muted)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'sidebar-item-active' : 'sidebar-item'
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* AI Indicator */}
        <div 
          className="mx-3 mb-3 p-4 rounded-2xl border"
          style={{ 
            background: 'linear-gradient(135deg, var(--accent-glow) 0%, transparent 100%)',
            borderColor: 'var(--border-accent)'
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-primary)' }}>AI Powered</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Gemini · pgvector RAG</p>
        </div>

        {/* User */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <div 
            className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors group cursor-pointer"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.username}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
            <button 
              onClick={handleLogout} 
              className="transition-opacity opacity-0 group-hover:opacity-100"
            >
              <LogOut 
                className="w-4 h-4" 
                style={{ color: 'var(--text-muted)' }} 
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--error)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

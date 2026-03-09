import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  Brain, LayoutDashboard, FileText, Upload,
  MessageSquare, HelpCircle, Search, LogOut,
  User, ChevronRight, Zap
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { clsx } from 'clsx'

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
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">AI Knowledge</h1>
            <p className="text-xs text-gray-500">Manager</p>
          </div>
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
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* AI Indicator */}
        <div className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-brand-900/40 to-purple-900/20 border border-brand-800/30">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs font-semibold text-brand-300">AI Powered</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">Gemini 1.5 Flash · pgvector RAG</p>
        </div>

        {/* User */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <LogOut className="w-4 h-4 text-gray-500 hover:text-red-400 transition-colors" />
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

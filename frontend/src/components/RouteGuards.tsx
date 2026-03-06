import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-300">
      Checking session...
    </div>
  )
}

export function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode
  permission?: string
}) {
  const location = useLocation()
  const { isHydrated, isAuthenticated, hasPermission } = useAuthStore((s) => ({
    isHydrated: s.isHydrated,
    isAuthenticated: s.isAuthenticated,
    hasPermission: s.hasPermission,
  }))

  if (!isHydrated) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated } = useAuthStore((s) => ({
    isHydrated: s.isHydrated,
    isAuthenticated: s.isAuthenticated,
  }))

  if (!isHydrated) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

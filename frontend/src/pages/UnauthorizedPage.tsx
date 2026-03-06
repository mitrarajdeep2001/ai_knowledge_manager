import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6">
          You are authenticated but do not have permission to view this page.
        </p>
        <Link to="/dashboard" className="btn-primary justify-center">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

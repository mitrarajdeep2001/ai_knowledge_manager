import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type StatusVariant = 'queued' | 'uploaded' | 'processing' | 'ready' | 'completed' | 'failed'

interface ProcessingStatusBadgeProps {
  status: StatusVariant
  label?: string
}

const statusConfig: Record<StatusVariant, { className: string; icon: ReactNode; label: string }> = {
  ready: {
    className: 'bg-green-900/40 text-green-300 border border-green-800/50',
    icon: <CheckCircle className="w-3 h-3 mr-1" />,
    label: 'Ready',
  },
  completed: {
    className: 'bg-green-900/40 text-green-300 border border-green-800/50',
    icon: <CheckCircle className="w-3 h-3 mr-1" />,
    label: 'Ready',
  },
  failed: {
    className: 'bg-red-900/40 text-red-300 border border-red-800/50',
    icon: <AlertCircle className="w-3 h-3 mr-1" />,
    label: 'Failed',
  },
  uploaded: {
    className: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
    icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
    label: 'Uploaded',
  },
  queued: {
    className: 'bg-blue-900/40 text-blue-300 border border-blue-800/50',
    icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
    label: 'Queued',
  },
  processing: {
    className: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/50 animate-pulse-slow',
    icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
    label: 'Processing',
  },
}

export default function ProcessingStatusBadge({ status, label }: ProcessingStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span className={`badge ${config.className}`}>
      {config.icon}
      {label || config.label}
    </span>
  )
}


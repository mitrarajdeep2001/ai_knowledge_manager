import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface ProgressBarProps {
  progress: number
  status: 'queued' | 'uploaded' | 'processing' | 'ready' | 'completed' | 'failed'
  message?: string
  showPercent?: boolean
  className?: string
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

const statusBadgeClass = (status: ProgressBarProps['status']) => {
  if (status === 'ready' || status === 'completed') {
    return 'bg-green-900/40 text-green-300 border border-green-800/50'
  }

  if (status === 'failed') {
    return 'bg-red-900/40 text-red-300 border border-red-800/50'
  }

  if (status === 'queued' || status === 'uploaded') {
    return 'bg-blue-900/40 text-blue-300 border border-blue-800/50'
  }

  return 'bg-yellow-900/40 text-yellow-300 border border-yellow-800/50'
}

const statusLabelFor = (status: ProgressBarProps['status']) =>
  status === 'ready' || status === 'completed'
    ? 'Ready'
    : status === 'failed'
      ? 'Failed'
      : status === 'uploaded'
        ? 'Uploaded'
        : status === 'queued'
          ? 'Queued'
          : 'Processing'

export default function ProgressBar({
  progress,
  status,
  message,
  showPercent = true,
  className = '',
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(clamp(progress))
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const target = clamp(progress)

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
    }

    const animate = () => {
      setDisplayProgress((prev) => {
        const delta = target - prev
        if (Math.abs(delta) < 0.4) {
          return target
        }

        return prev + delta * 0.15
      })

      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [progress])

  const colorClass =
    status === 'ready' || status === 'completed'
      ? 'bg-green-500'
      : status === 'failed'
        ? 'bg-red-500'
        : 'bg-brand-500'

  const statusLabel = statusLabelFor(status)

  return (
    <div className={`space-y-1 ${className}`} title={`${statusLabel}: ${Math.round(displayProgress)}%`}>
      <div className="flex items-center justify-between text-xs">
        <span className={`badge ${statusBadgeClass(status)}`}>
          {(status === 'ready' || status === 'completed') && <CheckCircle2 className="w-3 h-3 mr-1" />}
          {status === 'failed' && <AlertTriangle className="w-3 h-3 mr-1" />}
          {(status === 'queued' || status === 'uploaded' || status === 'processing') && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          {message || statusLabel}
        </span>
        {showPercent && <span className="text-gray-500">{Math.round(displayProgress)}%</span>}
      </div>

      <div className="relative h-2 w-full rounded-full bg-gray-800 overflow-hidden border border-gray-700">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${colorClass}`}
          style={{ width: `${displayProgress}%` }}
        />
        {(status === 'processing' || status === 'queued' || status === 'uploaded') && (
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </div>
    </div>
  )
}

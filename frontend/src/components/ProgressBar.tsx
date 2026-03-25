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

const statusBadgeStyle = (status: ProgressBarProps['status']): React.CSSProperties => {
  if (status === 'ready' || status === 'completed') {
    return { 
      backgroundColor: 'rgba(34, 197, 94, 0.15)', 
      color: '#4ade80', 
      border: '1px solid rgba(34, 197, 94, 0.3)' 
    }
  }

  if (status === 'failed') {
    return { 
      backgroundColor: 'rgba(239, 68, 68, 0.15)', 
      color: '#f87171', 
      border: '1px solid rgba(239, 68, 68, 0.3)' 
    }
  }

  if (status === 'queued' || status === 'uploaded') {
    return { 
      backgroundColor: 'rgba(96, 165, 250, 0.15)', 
      color: '#60a5fa', 
      border: '1px solid rgba(96, 165, 250, 0.3)' 
    }
  }

  return { 
    backgroundColor: 'rgba(250, 204, 21, 0.15)', 
    color: '#facc15', 
    border: '1px solid rgba(250, 204, 21, 0.3)' 
  }
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

  const barColor =
    status === 'ready' || status === 'completed'
      ? '#4ade80'
      : status === 'failed'
        ? '#ef4444'
        : '#6366f1'

  const statusLabel = statusLabelFor(status)

  return (
    <div className={`space-y-1 ${className}`} title={`${statusLabel}: ${Math.round(displayProgress)}%`}>
      <div className="flex items-center justify-between text-xs">
        <span className="badge" style={statusBadgeStyle(status)}>
          {(status === 'ready' || status === 'completed') && <CheckCircle2 className="w-3 h-3 mr-1" />}
          {status === 'failed' && <AlertTriangle className="w-3 h-3 mr-1" />}
          {(status === 'queued' || status === 'uploaded' || status === 'processing') && (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          )}
          {message || statusLabel}
        </span>
        {showPercent && <span style={{ color: 'var(--text-muted)' }}>{Math.round(displayProgress)}%</span>}
      </div>

      <div 
        className="relative h-2 w-full rounded-full overflow-hidden" 
        style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${displayProgress}%`, backgroundColor: barColor }}
        />
        {(status === 'processing' || status === 'queued' || status === 'uploaded') && (
          <div 
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'skeleton-shimmer 1.6s ease-in-out infinite'
            }}
          />
        )}
      </div>
    </div>
  )
}

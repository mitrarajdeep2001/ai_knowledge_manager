import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface ProgressBarProps {
  progress: number
  status: 'queued' | 'processing' | 'ready' | 'failed'
  message?: string
  showPercent?: boolean
  className?: string
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

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
    status === 'ready'
      ? 'bg-green-500'
      : status === 'failed'
        ? 'bg-red-500'
        : 'bg-brand-500'

  const statusLabel =
    status === 'ready'
      ? 'Ready'
      : status === 'failed'
        ? 'Failed'
        : status === 'queued'
          ? 'Queued'
          : 'Processing'

  return (
    <div className={`space-y-1 ${className}`} title={`${statusLabel}: ${Math.round(displayProgress)}%`}>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-gray-400">
          {status === 'ready' && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
          {status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          <span>{message || statusLabel}</span>
        </div>
        {showPercent && <span className="text-gray-500">{Math.round(displayProgress)}%</span>}
      </div>

      <div className="relative h-2 w-full rounded-full bg-gray-800 overflow-hidden border border-gray-700">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${colorClass}`}
          style={{ width: `${displayProgress}%` }}
        />
        {(status === 'processing' || status === 'queued') && (
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        )}
      </div>
    </div>
  )
}

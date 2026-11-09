'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { X, File, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

const cardVariants = cva(
  'relative flex w-full items-start gap-3 overflow-hidden rounded-[14px] border bg-card p-4 text-card-foreground shadow-sm transition-colors',
  {
    variants: {
      status: {
        uploading: 'border-border',
        complete: 'border-[var(--success)]/50',
        error: 'border-destructive/50',
      },
    },
    defaultVariants: { status: 'uploading' },
  },
)

export interface UploadProgressCardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'onTransitionEnd'
  >,
    VariantProps<typeof cardVariants> {
  /** The name of the file being ingested. */
  fileName: string
  /** Progress percentage (0-100). */
  progress: number
  /** Stage description shown next to the percentage, e.g. "Fetching from Dropbox…". */
  statusLabel: string
  /** Icon shown while the ingest is still running. */
  icon?: React.ReactNode
  /** Cancel an in-flight ingest. */
  onCancel?: () => void
  /** Retry a failed ingest. */
  onRetry?: () => void
  /** Dismiss a finished (complete or failed) card. */
  onDismiss?: () => void
  busy?: boolean
}

const UploadProgressCard = React.forwardRef<HTMLDivElement, UploadProgressCardProps>(
  ({ className, status = 'uploading', fileName, progress, statusLabel, icon, onCancel, onRetry, onDismiss, busy, ...props }, ref) => {
    const reduceMotion = useReducedMotion() ?? false
    const isComplete = status === 'complete'
    const isError = status === 'error'
    const running = status === 'uploading'

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: { duration: 0.15 } }}
        transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
        className={cn(cardVariants({ status }), className)}
        aria-busy={running}
        {...props}
      >
        <div className="shrink-0 pt-0.5" aria-hidden="true">
          {isComplete ? (
            <CheckCircle2 className="size-7 text-[var(--success)]" />
          ) : isError ? (
            <AlertCircle className="size-7 text-destructive" />
          ) : (
            icon || <File className="size-7 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-foreground">{fileName}</p>
          <div className="mt-2 space-y-1">
            <Progress
              value={progress}
              className="h-2"
              aria-label={`Ingest progress for ${fileName}`}
              aria-valuetext={`${Math.round(progress)}%`}
            />
            <div className="flex items-center justify-between gap-2 text-xs" role="status">
              <span className={cn(
                'min-w-0 truncate text-muted-foreground',
                isComplete && 'text-[var(--success)]',
                isError && 'text-destructive',
              )}>
                {statusLabel}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {isComplete ? '100%' : isError ? 'Failed' : `${Math.round(progress)}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isError && onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onRetry}
              disabled={busy}
              aria-label={`Retry ingest of ${fileName}`}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
          )}
          {(running && onCancel) || (!running && onDismiss) ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={running ? onCancel : onDismiss}
              disabled={busy}
              aria-label={running ? `Cancel ingest of ${fileName}` : `Dismiss ${fileName}`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </motion.div>
    )
  },
)
UploadProgressCard.displayName = 'UploadProgressCard'

export { UploadProgressCard }

'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CloudUpload, Minus } from 'lucide-react'
import { useIngest, ingestStatusLabel } from '../lib/ingest'
import { useConfirm } from '../lib/confirm'
import type { IngestJob } from '../lib/media-ingest-core'
import { UploadProgressCard } from './ui/upload-progress-card'
import { Button } from './ui/button'

function cardStatusFor(job: IngestJob): 'uploading' | 'complete' | 'error' {
  if (job.phase === 'complete') return 'complete'
  if (job.phase === 'failed') return 'error'
  return 'uploading'
}

/**
 * Floating ingest progress panel anchored to the corner of the admin shell,
 * mirroring the Bunny dashboard upload card. Reads shared state from
 * IngestProvider; completed cards stay until dismissed, failed cards offer retry.
 */
export function IngestWidget() {
  const ingest = useIngest()
  const confirmAction = useConfirm()
  const reduceMotion = useReducedMotion() ?? false
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  // Completed jobs only surface if this session watched them in flight;
  // historical completions live on the Media Ingest page, not the widget.
  const seen = useRef<Set<number>>(new Set())

  useEffect(() => {
    for (const job of ingest?.jobs ?? []) {
      if (job.phase === 'fetching' || job.phase === 'transcoding') seen.current.add(job.id)
    }
  }, [ingest?.jobs])

  const jobs = (ingest?.jobs ?? []).filter(job => {
    if (job.phase === 'cancelled' || dismissed.has(job.id)) return false
    if (job.phase === 'complete' && !seen.current.has(job.id)) return false
    return true
  })

  if (!ingest || jobs.length === 0) return null

  async function cancelJob(job: IngestJob) {
    const ok = await confirmAction({
      title: `Cancel ingest of "${job.title}"?`,
      description: 'The Bunny video and its content entry will be removed.',
      approveLabel: 'Cancel ingest',
    })
    if (!ok || !ingest) return
    setBusyId(job.id)
    try {
      await ingest.cancel(job.id)
    } finally {
      setBusyId(null)
    }
  }

  async function retryJob(job: IngestJob) {
    if (!ingest) return
    setBusyId(job.id)
    try {
      await ingest.retry(job.id)
    } finally {
      setBusyId(null)
    }
  }

  function dismiss(job: IngestJob) {
    setDismissed(current => new Set(current).add(job.id))
  }

  return (
    <motion.aside
      initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
      className="fixed bottom-4 right-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-lg"
      aria-label="Media ingest progress"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <CloudUpload className="size-4 text-accent" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Media ingest</span>
        <span className="text-xs text-muted-foreground">{jobs.length}</span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setCollapsed(value => !value)}
          aria-label={collapsed ? 'Expand ingest progress' : 'Collapse ingest progress'}
          aria-expanded={!collapsed}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {!collapsed && (
        <ul className="max-h-[50dvh] space-y-2 overflow-y-auto p-3">
          <AnimatePresence initial={false}>
            {jobs.map(job => (
              <li key={job.id}>
                <UploadProgressCard
                  fileName={job.title}
                  progress={job.progress}
                  status={cardStatusFor(job)}
                  statusLabel={ingestStatusLabel(job)}
                  busy={busyId === job.id}
                  onCancel={job.phase === 'fetching' || job.phase === 'transcoding' ? () => void cancelJob(job) : undefined}
                  onRetry={job.phase === 'failed' ? () => void retryJob(job) : undefined}
                  onDismiss={job.phase === 'complete' || job.phase === 'failed' ? () => dismiss(job) : undefined}
                />
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </motion.aside>
  )
}

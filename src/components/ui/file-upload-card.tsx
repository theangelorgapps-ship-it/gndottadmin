'use client'

import * as React from 'react'
import { UploadCloud, X, CheckCircle2, Trash2 } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export interface UploadedFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
}

interface FileUploadCardProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onAnimationStart' | 'onAnimationEnd' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'onTransitionEnd'
  > {
  files: UploadedFile[]
  onFilesChange: (files: File[]) => void
  onFileRemove: (id: string) => void
  onClose?: () => void
}

export const FileUploadCard = React.forwardRef<HTMLDivElement, FileUploadCardProps>(
  ({ className, files = [], onFilesChange, onFileRemove, onClose, ...props }, ref) => {
    const [isDragging, setIsDragging] = React.useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const reduceMotion = useReducedMotion() ?? false

    function handleDrag(event: React.DragEvent<HTMLButtonElement>, dragging: boolean) {
      event.preventDefault()
      event.stopPropagation()
      setIsDragging(dragging)
    }

    function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
      handleDrag(event, false)
      const droppedFiles = Array.from(event.dataTransfer.files)
      if (droppedFiles.length > 0) onFilesChange(droppedFiles)
    }

    function formatFileSize(bytes: number) {
      if (bytes === 0) return '0 Bytes'
      const unit = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      const index = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(unit)))
      return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(2))} ${sizes[index]}`
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: 'easeOut' }}
        className={cn(
          'w-full max-w-lg min-w-0 rounded-[14px] border border-border bg-card',
          className,
        )}
        {...props}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-accent" aria-hidden="true">
                <UploadCloud className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-foreground">Upload files</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Add files to the media library.</p>
              </div>
            </div>
            {onClose && (
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={onClose} aria-label="Close upload panel">
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            aria-label="Choose files to upload"
            onChange={(event) => {
              const input = event.currentTarget
              const selectedFiles = Array.from(input.files ?? [])
              if (selectedFiles.length > 0) onFilesChange(selectedFiles)
              input.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => handleDrag(event, true)}
            onDragLeave={(event) => handleDrag(event, false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className={cn(
              'mt-5 flex w-full min-w-0 flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-background p-6 text-center transition-colors hover:border-ring/70 sm:p-8',
              isDragging && 'border-primary bg-primary/10',
            )}
            aria-describedby="file-upload-formats"
          >
            <UploadCloud className="mb-3 size-8 text-accent" aria-hidden="true" />
            <span className="font-semibold text-foreground">Choose files or drag and drop them here</span>
            <span id="file-upload-formats" className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, PDF, and MP4 formats, up to 50 MB.
            </span>
            <span className="btn btn-dark btn-sm mt-4" aria-hidden="true">Browse files</span>
          </button>
        </div>

        {files.length > 0 && (
          <div className="border-t border-border p-4 sm:p-6">
            <ul className="space-y-4" aria-label="File uploads">
              <AnimatePresence>
                {files.map((file) => {
                  const busy = file.status === 'uploading'
                  return (
                    <motion.li
                      key={file.id}
                      initial={{ opacity: 0, x: reduceMotion ? 0 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: reduceMotion ? 0 : -10 }}
                      transition={{ duration: reduceMotion ? 0.01 : 0.16 }}
                      layout
                      className="flex min-w-0 items-start justify-between gap-3"
                      aria-busy={busy}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-muted-foreground" aria-hidden="true">
                          {file.file.type.split('/')[1]?.toUpperCase().substring(0, 3) || 'FILE'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium text-foreground">{file.file.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-1 text-xs text-muted-foreground" role="status">
                            <span>
                              {busy
                                ? `${formatFileSize((file.file.size * file.progress) / 100)} of ${formatFileSize(file.file.size)}`
                                : formatFileSize(file.file.size)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={cn(
                              busy && 'text-primary',
                              file.status === 'completed' && 'text-[var(--success)]',
                              file.status === 'error' && 'text-destructive',
                            )}>
                              {busy ? 'Uploading…' : file.status === 'completed' ? 'Completed' : 'Failed'}
                            </span>
                          </div>
                          {busy && (
                            <Progress
                              value={file.progress}
                              className="mt-2 h-1.5"
                              aria-label={`Upload progress for ${file.file.name}`}
                              aria-valuetext={`${Math.round(file.progress)}% uploaded`}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {file.status === 'completed' && <CheckCircle2 className="size-5 text-[var(--success)]" aria-hidden="true" />}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-10"
                          onClick={() => onFileRemove(file.id)}
                          aria-label={busy ? `Cancel upload of ${file.file.name}` : `Remove ${file.file.name} from uploads`}
                        >
                          {file.status === 'completed' ? <Trash2 className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
                        </Button>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </motion.div>
    )
  },
)
FileUploadCard.displayName = 'FileUploadCard'

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import {
  Check,
  Copy,
  ExternalLink,
  File as FileIcon,
  HardDrive,
  Library,
  LoaderCircle,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react'
import { adminListR2Media, adminDeleteR2Object } from '../../lib/admin'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import { FileUploadCard, type UploadedFile } from '../../components/ui/file-upload-card'

export const Route = createFileRoute('/admin/media-library')({
  loader: async () => await adminListR2Media(),
  component: Page,
})

type R2MediaObject = {
  key: string
  size: number
  uploaded: string | null
  etag?: string
  url: string
}

type R2MediaData = {
  ok: boolean
  error?: string
  objects: R2MediaObject[]
  truncated?: boolean
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fileType(key: string) {
  const parts = key.split('.')
  return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE'
}

function Page() {
  const data = Route.useLoaderData() as R2MediaData
  const router = useRouter()
  const confirmAction = useConfirm()
  const notify = useToast()
  const [query, setQuery] = useState('')
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [copyingKey, setCopyingKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const xhrMap = useRef(new Map<string, XMLHttpRequest>())

  const patchUpload = (id: string, patch: Partial<UploadedFile>) =>
    setUploads((prev) => prev.map((upload) => (upload.id === id ? { ...upload, ...patch } : upload)))

  function startUploads(newFiles: File[]) {
    if (newFiles.length === 0) return
    setError(null)
    for (const file of newFiles) {
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setUploads((prev) => [...prev, { id, file, progress: 0, status: 'uploading' }])
      const form = new FormData()
      form.append('file', file)
      const xhr = new XMLHttpRequest()
      xhrMap.current.set(id, xhr)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          patchUpload(id, { progress: Math.round((event.loaded / event.total) * 100) })
        }
      }
      xhr.onload = () => {
        xhrMap.current.delete(id)
        let json: any = null
        try { json = JSON.parse(xhr.responseText) } catch { /* The endpoint may return a non-JSON error. */ }
        if (xhr.status >= 200 && xhr.status < 300 && json?.ok) {
          patchUpload(id, { progress: 100, status: 'completed' })
          notify({ title: 'Upload complete', description: file.name, variant: 'success' })
          router.invalidate()
        } else {
          const message = json?.error ?? `Could not upload ${file.name}.`
          patchUpload(id, { status: 'error' })
          setError(message)
          notify({ title: 'Upload failed', description: message, variant: 'destructive' })
        }
      }
      xhr.onerror = () => {
        xhrMap.current.delete(id)
        const message = `Could not upload ${file.name}. Check your connection and try again.`
        patchUpload(id, { status: 'error' })
        setError(message)
        notify({ title: 'Upload failed', description: message, variant: 'destructive' })
      }
      xhr.onabort = () => {
        xhrMap.current.delete(id)
      }
      xhr.open('POST', '/api/upload')
      xhr.send(form)
    }
  }

  function removeUpload(id: string) {
    xhrMap.current.get(id)?.abort()
    xhrMap.current.delete(id)
    setUploads((prev) => prev.filter((upload) => upload.id !== id))
  }

  async function copyUrl(key: string, url: string) {
    setCopyingKey(key)
    setCopiedKey(null)
    setError(null)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is not available in this browser.')
      await navigator.clipboard.writeText(`${location.origin}${url}`)
      setCopiedKey(key)
      notify({ title: 'URL copied', description: key, variant: 'success' })
    } catch (e: any) {
      const message = e?.message ?? 'Could not copy the file URL.'
      setError(message)
      notify({ title: 'Copy failed', description: message, variant: 'destructive' })
    } finally {
      setCopyingKey(null)
    }
  }

  const allObjects = data?.objects ?? []
  const normalizedQuery = query.trim().toLowerCase()
  const objects = allObjects.filter((object) => object.key.toLowerCase().includes(normalizedQuery))
  const isImage = (key: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(key)
  const totalBytes = allObjects.reduce((total, object) => total + object.size, 0)

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Media Library</span></div>

      <header className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold tracking-[0.02em] text-accent">Content assets</p>
          <h1 className="m-0 text-[1.625rem] font-semibold">Media Library</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Upload, preview, copy, and manage public files used across GoodNews Halobox.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <HardDrive className="size-4 text-accent" aria-hidden="true" />
          R2 object storage
        </span>
      </header>

      <section aria-labelledby="media-upload-heading" className="mb-5 min-w-0">
        <h2 id="media-upload-heading" className="sr-only">Upload media</h2>
        <FileUploadCard
          files={uploads}
          onFilesChange={startUploads}
          onFileRemove={removeUpload}
          style={{ maxWidth: 'none', width: '100%' }}
        />
      </section>

      <section aria-labelledby="media-files-heading" className="min-w-0">
        <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="media-files-heading" className="m-0 text-base font-semibold">Stored files</h2>
            <p className="mb-0 mt-1 text-xs text-muted-foreground" role="status">
              {normalizedQuery ? `${objects.length} of ${allObjects.length} files` : `${allObjects.length} ${allObjects.length === 1 ? 'file' : 'files'}`} · {fmtSize(totalBytes)} total
            </p>
          </div>
          <div className="w-full min-w-0 sm:max-w-sm">
            <label htmlFor="media-search" className="mb-1.5 block text-xs font-semibold tracking-[0.02em] text-muted-foreground">
              Search stored files
            </label>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id="media-search"
                type="search"
                placeholder="Search by filename"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-[10px] border border-input bg-card py-2.5 pl-10 pr-11 text-sm text-foreground placeholder:text-[#71859e]"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear media search"
                  onClick={() => setQuery('')}
                  className="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {data?.ok === false && (
          <div className="rounded-[14px] border border-[rgba(251,113,133,0.3)] bg-[rgba(251,113,133,0.08)] p-5 text-sm text-[#fda4af]" role="alert">
            <strong className="mb-1 block font-semibold">Media storage is unavailable</strong>
            {data.error}
          </div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        {data?.truncated && (
          <p className="rounded-[10px] border border-border bg-card px-4 py-3 text-xs text-muted-foreground" role="status">
            Showing the first 200 objects. This bucket contains more files.
          </p>
        )}

        {data?.ok && objects.length > 0 && (
          <>
            <p className="sr-only" role="status">
              Showing {objects.length} of {allObjects.length} stored files.
            </p>
            <ul className="grid min-w-0 grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3" aria-label="Stored media files">
              {objects.map((object) => {
                const deleting = deletingKey === object.key
                const copying = copyingKey === object.key
                const copied = copiedKey === object.key
                return (
                  <li key={object.key} className="min-w-0">
                    <article className="flex h-full min-w-0 flex-col rounded-[14px] border border-border bg-card" aria-busy={deleting}>
                      <a
                        href={object.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${object.key} in a new tab`}
                        className="flex aspect-[16/10] min-w-0 items-center justify-center rounded-t-[13px] border-b border-border bg-background p-3 transition-colors hover:bg-secondary"
                      >
                        {isImage(object.key) ? (
                          <img
                            src={object.url}
                            alt={`Preview of ${object.key}`}
                            className="h-full w-full min-w-0 object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-2 text-muted-foreground">
                            <FileIcon className="size-10 text-accent" aria-hidden="true" />
                            <span className="text-xs font-semibold">{fileType(object.key)}</span>
                          </span>
                        )}
                      </a>

                      <div className="flex min-w-0 flex-1 flex-col p-4">
                        <div className="min-w-0">
                          <h3 className="m-0 break-words text-sm font-semibold text-foreground">{object.key}</h3>
                          <a
                            href={object.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block truncate text-xs text-muted-foreground hover:text-accent"
                            aria-label={`Open URL for ${object.key}`}
                            title={object.url}
                          >
                            {object.url}
                          </a>
                        </div>

                        <dl className="mb-4 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">Type</dt>
                            <dd className="m-0 mt-0.5 truncate text-foreground">{fileType(object.key)}</dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-muted-foreground">Size</dt>
                            <dd className="m-0 mt-0.5 text-foreground">{fmtSize(object.size)}</dd>
                          </div>
                          <div className="col-span-2 min-w-0">
                            <dt className="text-muted-foreground">Uploaded</dt>
                            <dd className="m-0 mt-0.5 text-foreground">
                              {object.uploaded ? String(object.uploaded).slice(0, 16).replace('T', ' ') : '—'}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-auto flex min-w-0 flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-dark btn-sm min-w-0 flex-1"
                            disabled={deletingKey !== null || copyingKey !== null}
                            aria-busy={copying}
                            onClick={() => void copyUrl(object.key, object.url)}
                          >
                            {copying ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : copied ? <Check className="size-4 text-[var(--success)]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
                            <span aria-live="polite">{copying ? 'Copying…' : copied ? 'Copied' : 'Copy URL'}</span>
                          </button>
                          <a
                            href={object.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-dark btn-sm flex-1"
                            aria-label={`Open ${object.key} in a new tab`}
                          >
                            <ExternalLink className="size-4" aria-hidden="true" />
                            Open
                          </a>
                          <button
                            type="button"
                            className="btn-danger min-h-10 flex-1 gap-1.5"
                            disabled={deletingKey !== null}
                            aria-busy={deleting}
                            onClick={async () => {
                              const ok = await confirmAction({
                                title: `Delete ${object.key}?`,
                                description: 'The file will be permanently removed from storage.',
                                approveLabel: 'Delete',
                              })
                              if (!ok) return
                              setDeletingKey(object.key)
                              setError(null)
                              try {
                                await adminDeleteR2Object({ data: object.key })
                                notify({ title: 'File deleted', description: object.key, variant: 'success' })
                                await router.invalidate()
                              } catch (e: any) {
                                const message = e?.message ?? 'Could not delete the file.'
                                setError(message)
                                notify({ title: 'Delete failed', description: message, variant: 'destructive' })
                              } finally {
                                setDeletingKey(null)
                              }
                            }}
                          >
                            {deleting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                            {deleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {data?.ok && objects.length === 0 && (
          <div className="flex min-w-0 flex-col items-center rounded-[14px] border border-dashed border-border bg-card px-5 py-12 text-center">
            {normalizedQuery ? <SearchX className="mb-3 size-8 text-accent" aria-hidden="true" /> : <Library className="mb-3 size-8 text-accent" aria-hidden="true" />}
            <h3 className="m-0 text-sm font-semibold">{normalizedQuery ? 'No matching files' : 'No files in storage yet'}</h3>
            <p className="mb-0 mt-2 max-w-md text-sm text-muted-foreground">
              {normalizedQuery ? `No stored filenames match “${query.trim()}”.` : 'Upload a file above to make it available to your content.'}
            </p>
            {normalizedQuery && (
              <button type="button" className="btn btn-dark btn-sm mt-4" onClick={() => setQuery('')}>
                <X className="size-4" aria-hidden="true" />
                Clear Search
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

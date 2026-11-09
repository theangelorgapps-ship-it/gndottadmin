import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Check, CloudUpload, Copy } from 'lucide-react'
import { ingestFormOptions, listIngestJobs } from '../../lib/media-ingest'
import { useIngest, ingestStatusLabel } from '../../lib/ingest'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { embedSnippet, type IngestDestination, type IngestJob } from '../../lib/media-ingest-core'
import { UploadProgressCard } from '../../components/ui/upload-progress-card'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/admin/media-ingest')({
  loader: async () => {
    const [jobsRes, options] = await Promise.all([listIngestJobs(), ingestFormOptions()])
    return { jobsRes, options }
  },
  component: AdminMediaIngest,
})

const DESTINATIONS: { value: IngestDestination; label: string }[] = [
  { value: 'sermon', label: 'Sermon' },
  { value: 'teaching', label: 'Teaching episode' },
  { value: 'show', label: 'Show episode' },
  { value: 'video', label: 'Video' },
]

const SECTIONS: Record<IngestDestination, { label: string; to: string }> = {
  sermon: { label: 'Sermons', to: '/admin/movies' },
  teaching: { label: 'Teaching Episodes', to: '/admin/teaching-episodes' },
  show: { label: 'Show Episodes', to: '/admin/episodes' },
  video: { label: 'Videos', to: '/admin/videos' },
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const hours = Math.floor(minutes / 60)
  const rest = String(total % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes % 60).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}

function EmbedSnippet({ libraryId, videoId }: { libraryId: string; videoId: string }) {
  const [copied, setCopied] = useState(false)
  const snippet = embedSnippet(libraryId, videoId)
  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions); leave the snippet selectable.
    }
  }
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Embed player</span>
        <Button type="button" variant="secondary" size="sm" className="h-8 px-2" onClick={() => void copy()}>
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy embed'}
        </Button>
      </div>
      <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-background p-2.5 text-xs text-muted-foreground">{snippet}</pre>
    </div>
  )
}

function AdminMediaIngest() {
  const { jobsRes, options } = Route.useLoaderData()
  const ingest = useIngest()
  const notify = useToast()
  const confirmAction = useConfirm()

  const configured = ingest?.loaded ? ingest.configured : jobsRes.configured
  const libraryId = ingest?.loaded ? ingest.libraryId : jobsRes.libraryId
  const jobs = useMemo(() => {
    const source = ingest?.loaded ? ingest.jobs : jobsRes.jobs
    return source.filter(job => job.phase !== 'cancelled')
  }, [ingest?.loaded, ingest?.jobs, jobsRes.jobs])

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState<IngestDestination>('sermon')
  const [seriesChoice, setSeriesChoice] = useState('')
  const [seasonChoice, setSeasonChoice] = useState('')
  const [newSeriesTitle, setNewSeriesTitle] = useState('')
  const [newSeasonTitle, setNewSeasonTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const episodic = destination === 'teaching' || destination === 'show'
  const seriesOptions = destination === 'teaching' ? options.teachings : options.shows
  const seasonOptions = useMemo(
    () => (options.seasons as any[]).filter(season => String(season.entertainment_id) === seriesChoice),
    [options.seasons, seriesChoice],
  )

  function switchDestination(value: IngestDestination) {
    setDestination(value)
    setSeriesChoice('')
    setSeasonChoice('')
    setNewSeriesTitle('')
    setNewSeasonTitle('')
    setError(null)
  }

  async function submit() {
    if (busy || !ingest) return
    setBusy(true)
    setError(null)
    try {
      await ingest.ingest({
        url,
        title,
        destination,
        seriesId: episodic && seriesChoice !== 'new' ? seriesChoice : undefined,
        seasonId: episodic && seriesChoice !== 'new' && seasonChoice !== 'new' ? seasonChoice : undefined,
        newSeriesTitle: episodic && seriesChoice === 'new' ? newSeriesTitle : undefined,
        newSeasonTitle: episodic && (seriesChoice === 'new' || seasonChoice === 'new') ? newSeasonTitle : undefined,
      })
      notify({ title: 'Ingest started', description: title.trim(), variant: 'success' })
      setUrl('')
      setTitle('')
      setSeriesChoice('')
      setSeasonChoice('')
      setNewSeriesTitle('')
      setNewSeasonTitle('')
    } catch (e: any) {
      setError(e?.message ?? 'Could not start the ingest.')
      notify({ title: 'Ingest failed to start', description: e?.message ?? 'Could not start the ingest.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function cancelJob(job: IngestJob) {
    if (!ingest) return
    const ok = await confirmAction({
      title: `Cancel ingest of "${job.title}"?`,
      description: 'The Bunny video and its content entry will be removed.',
      approveLabel: 'Cancel ingest',
    })
    if (!ok) return
    try {
      await ingest.cancel(job.id)
      notify({ title: 'Ingest cancelled', description: job.title, variant: 'success' })
    } catch (e: any) {
      notify({ title: 'Cancel failed', description: e?.message ?? 'Could not cancel the ingest.', variant: 'destructive' })
    }
  }

  async function retryJob(job: IngestJob) {
    if (!ingest) return
    try {
      await ingest.retry(job.id)
      notify({ title: 'Ingest restarted', description: job.title, variant: 'success' })
    } catch (e: any) {
      notify({ title: 'Retry failed', description: e?.message ?? 'Could not retry the ingest.', variant: 'destructive' })
    }
  }

  return (
    <div className="min-w-0">
      <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Media Ingest</span></div>
      <div className="toolbar">
        <span className="text-sm text-muted-foreground">Paste a Dropbox share link — the video is fetched into Bunny Stream, transcoded, and filed into its section automatically.</span>
      </div>

      {!configured && (
        <div className="mb-4 rounded-[14px] border border-border bg-card p-5" role="status">
          <h2 className="mb-1 text-base font-semibold text-foreground">Bunny Stream is not configured</h2>
          <p className="text-sm text-muted-foreground">Set the Library ID and API Key in Settings → Bunny Stream, then reload this page.</p>
        </div>
      )}

      <form
        className="mb-6 rounded-[14px] border border-border bg-card p-5 sm:p-6"
        noValidate
        aria-busy={busy}
        onSubmit={event => { event.preventDefault(); void submit() }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-accent" aria-hidden="true">
            <CloudUpload className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Ingest from Dropbox</h2>
            <p className="text-sm text-muted-foreground">Bunny Stream fetches the file directly — no manual download or upload.</p>
          </div>
        </div>
        <div className="modal-form">
          <div className="mfield span2">
            <label htmlFor="ingest-url">Dropbox shared link <span aria-hidden="true">*</span></label>
            <input
              id="ingest-url"
              value={url}
              disabled={busy || !configured}
              placeholder="https://www.dropbox.com/s/…/video.mp4?dl=0"
              aria-required="true"
              onChange={event => setUrl(event.target.value)}
            />
          </div>
          <div className="mfield">
            <label htmlFor="ingest-title">Title <span aria-hidden="true">*</span></label>
            <input
              id="ingest-title"
              value={title}
              disabled={busy || !configured}
              aria-required="true"
              onChange={event => setTitle(event.target.value)}
            />
          </div>
          <div className="mfield">
            <label htmlFor="ingest-destination">Destination <span aria-hidden="true">*</span></label>
            <select
              id="ingest-destination"
              value={destination}
              disabled={busy || !configured}
              onChange={event => switchDestination(event.target.value as IngestDestination)}
            >
              {DESTINATIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          {episodic && (
            <>
              <div className="mfield">
                <label htmlFor="ingest-series">{destination === 'teaching' ? 'Teaching volume' : 'Series'} <span aria-hidden="true">*</span></label>
                <select
                  id="ingest-series"
                  value={seriesChoice}
                  disabled={busy || !configured}
                  onChange={event => { setSeriesChoice(event.target.value); setSeasonChoice('') }}
                >
                  <option value="">Choose…</option>
                  {(seriesOptions as any[]).map(series => <option key={series.id} value={String(series.id)}>{series.name}</option>)}
                  <option value="new">＋ New {destination === 'teaching' ? 'volume' : 'series'}…</option>
                </select>
              </div>
              {seriesChoice === 'new' ? (
                <div className="mfield">
                  <label htmlFor="ingest-new-series">New {destination === 'teaching' ? 'volume' : 'series'} title <span aria-hidden="true">*</span></label>
                  <input
                    id="ingest-new-series"
                    value={newSeriesTitle}
                    disabled={busy}
                    aria-required="true"
                    onChange={event => setNewSeriesTitle(event.target.value)}
                  />
                </div>
              ) : seriesChoice ? (
                <div className="mfield">
                  <label htmlFor="ingest-season">Season <span aria-hidden="true">*</span></label>
                  <select
                    id="ingest-season"
                    value={seasonChoice}
                    disabled={busy || !configured}
                    onChange={event => setSeasonChoice(event.target.value)}
                  >
                    <option value="">Choose…</option>
                    {seasonOptions.map((season: any) => <option key={season.id} value={String(season.id)}>{season.name}</option>)}
                    <option value="new">＋ New season…</option>
                  </select>
                </div>
              ) : null}
              {(seasonChoice === 'new' || (seriesChoice === 'new' && newSeriesTitle)) && (
                <div className="mfield">
                  <label htmlFor="ingest-new-season">New season title</label>
                  <input
                    id="ingest-new-season"
                    value={newSeasonTitle}
                    disabled={busy}
                    placeholder="Volume 1"
                    onChange={event => setNewSeasonTitle(event.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={busy || !configured}>
            {busy ? 'Starting…' : 'Start ingest'}
          </button>
          {!configured && <span className="text-xs text-muted-foreground">Configure Bunny Stream first.</span>}
        </div>
      </form>

      <section aria-label="Ingest jobs">
        <h2 className="mb-3 text-base font-semibold text-foreground">Jobs</h2>
        {jobs.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card p-6 text-center">
            <p className="font-medium text-foreground">No ingests yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Jobs you start will appear here with live transcoding progress.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map(job => {
              const active = job.phase === 'fetching' || job.phase === 'transcoding'
              const section = SECTIONS[job.destination]
              if (active || job.phase === 'failed') {
                return (
                  <li key={job.id}>
                    <UploadProgressCard
                      fileName={job.title}
                      progress={job.progress}
                      status={job.phase === 'failed' ? 'error' : 'uploading'}
                      statusLabel={`${ingestStatusLabel(job)} · ${section.label}`}
                      busy={busy}
                      onCancel={active ? () => void cancelJob(job) : undefined}
                      onRetry={job.phase === 'failed' ? () => void retryJob(job) : undefined}
                    />
                  </li>
                )
              }
              const duration = formatDuration(job.duration)
              return (
                <li key={job.id} className="rounded-[14px] border border-[var(--success)]/40 bg-card p-4 sm:p-5">
                  <div className="flex min-w-0 items-start gap-4">
                    {job.thumbnail_url ? (
                      <img src={job.thumbnail_url} alt="" className="hidden w-28 shrink-0 rounded-md border border-border object-cover sm:block" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold text-foreground">{job.title}</p>
                        <span className="pill on">Complete</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Link to={section.to} className="text-primary underline-offset-4 hover:underline">{section.label}</Link>
                        {duration && <span aria-hidden="true"> · {duration}</span>}
                        {job.resolutions && <span aria-hidden="true"> · {job.resolutions}</span>}
                      </p>
                      {libraryId && job.bunny_video_id && (
                        <EmbedSnippet libraryId={libraryId} videoId={job.bunny_video_id} />
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

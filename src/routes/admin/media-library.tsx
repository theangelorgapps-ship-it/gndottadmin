import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, File as FileIcon, FolderSearch, ImagePlus, LoaderCircle, RefreshCw, Search, ScanText, Square, Trash2, X } from 'lucide-react'
import { listMediaLibrary, discoverMediaBatch, claimMediaOcr, completeMediaOcr, releaseMediaOcr, deleteLibraryMedia } from '../../lib/media-library'
import { boundedBytes, MAX_UPLOAD, OCR_BATCH_SIZE, type MediaAsset, type MediaFilters } from '../../lib/media-library-core'
import { UploadDialog } from '../../components/UploadDialog'
import { InteractiveFolderGallery } from '../../components/ui/interactive-folder-gallery'
import { useConfirm } from '../../lib/confirm'
import { useToast } from '../../lib/toast'
import '../../media-library.css'

export const Route = createFileRoute('/admin/media-library')({ loader: () => listMediaLibrary({ data: {} }), component: Page })
type LibraryData = Awaited<ReturnType<typeof listMediaLibrary>>
const bytesLabel = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
function boundedJob<T>(promise: Promise<T>, signal: AbortSignal, timeout: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Indexing paused.')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); reject(new Error('Image recognition timed out. Retry this image.')) }, timeout)
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    promise.then(value => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(value) }, error => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(error) })
  })
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'
function Page() {
  const initial = Route.useLoaderData(); const [data, setData] = useState<LibraryData>(initial)
  const [filters, setFilters] = useState<MediaFilters>({ mode: 'text' }); const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'' | 'discover' | 'ocr'>(''); const [status, setStatus] = useState(''); const [progress, setProgress] = useState(0)
  const [error, setError] = useState(''); const [listError, setListError] = useState(''); const [loading, setLoading] = useState(false); const [uploadOpen, setUploadOpen] = useState(false)
  const [copied, setCopied] = useState(''); const [deleting, setDeleting] = useState(''); const cancelled = useRef(false)
  const jobController = useRef<AbortController | null>(null)
  const worker = useRef<{ terminate: () => Promise<unknown> } | null>(null); const fetchVersion = useRef(0); const alive = useRef(true)
  const confirmAction = useConfirm(); const notify = useToast()
  useEffect(() => { alive.current = true; return () => { alive.current = false; cancelled.current = true; jobController.current?.abort(); void worker.current?.terminate().catch(() => {}) } }, [])
  const refresh = useCallback(async () => {
    const version = ++fetchVersion.current; setLoading(true)
    try { const next = await listMediaLibrary({ data: filters }); if (alive.current && version === fetchVersion.current) { setData(next); setListError('') } }
    catch (err) { if (alive.current && version === fetchVersion.current) setListError(message(err)) }
    finally { if (alive.current && version === fetchVersion.current) setLoading(false) }
  }, [filters])
  useEffect(() => { void refresh() }, [refresh])
  function change(patch: MediaFilters) { setFilters(current => ({ ...current, ...patch, offset: patch.offset ?? 0 })) }
  async function discover(restart = false) {
    if (busy) return
    cancelled.current = false; setBusy('discover'); setError(''); setStatus('Discovering public media…')
    try {
      // Bounded runs keep CPU, request count and R2/D1 work predictable. Server owns cursor/lease.
      for (let batch = 0; batch < 10 && !cancelled.current; batch++) {
        const result = await discoverMediaBatch({ data: { restart: batch === 0 && restart } })
        if (!alive.current) break
        setStatus(`${result.discovered} public files discovered${result.finished ? ' · Discovery complete' : ' · Saved progress'}`)
        if (result.finished) break
      }
      if (alive.current) await refresh()
    } catch (err) { if (alive.current) setError(message(err)) }
    finally { if (alive.current) setBusy('') }
  }
  async function indexImages(retryErrors = false) {
    if (busy) return
    cancelled.current = false; setBusy('ocr'); setError(''); setProgress(0); setStatus('Preparing image text recognition…')
    let remaining: { key: string; lease: string }[] = []
    const controller = new AbortController(); jobController.current = controller
    try {
      const jobs = await claimMediaOcr({ data: { retryErrors } }); remaining = [...jobs]
      if (!jobs.length) { setStatus('No images are waiting to be indexed. Discover media to find new files.'); return }
      const { createWorker } = await import('tesseract.js')
      const creation = createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', workerBlobURL: false,
        logger: (event: { status: string; progress: number }) => { if (alive.current && !cancelled.current && event.status === 'recognizing text') setProgress(Math.round(event.progress * 100)) },
      }).then(async engine => {
        if (controller.signal.aborted) { await engine.terminate(); throw new Error('Indexing paused.') }
        return engine
      })
      const engine = await boundedJob(creation, controller.signal, 120000)
      worker.current = engine
      for (const [index, job] of jobs.entries()) {
        if (cancelled.current) break
        if (alive.current) { setStatus(`Reading image ${index + 1} of ${jobs.length}`); setProgress(0) }
        try {
          const response = await fetch(job.url, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) })
          if (!response.ok) throw new Error('The image could not be loaded.')
          if (Number(response.headers.get('content-length')) > MAX_UPLOAD) throw new Error('This image is too large for OCR.')
          const imageBytes = await boundedBytes(response.body, MAX_UPLOAD)
          const blob = new Blob([imageBytes.buffer as ArrayBuffer])
          if (blob.size > MAX_UPLOAD) throw new Error('This image is too large for OCR.')
          // The OCR engine sees only decoded pixels: never the filename, alt text, or catalog metadata.
          const bitmap = await createImageBitmap(blob)
          if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); throw new Error('This image is larger than the 40 megapixel OCR limit.') }
          const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
          const ctx = canvas.getContext('2d'); if (!ctx) { bitmap.close(); throw new Error('Image decoding is unavailable in this browser.') }
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
          const result = await boundedJob(engine.recognize(canvas), controller.signal, 90000)
          canvas.width = canvas.height = 1
          if (cancelled.current) break
          await completeMediaOcr({ data: { ...job, text: result.data.text.slice(0, 100_000), confidence: result.data.confidence } })
        } catch (err) {
          if (cancelled.current) break
          await completeMediaOcr({ data: { ...job, error: message(err) } })
          if (message(err).startsWith('Image recognition timed out')) { remaining = remaining.filter(item => item.key !== job.key); break }
        }
        remaining = remaining.filter(item => item.key !== job.key)
      }
      if (alive.current) setStatus(cancelled.current ? 'Indexing paused. Unfinished images are queued for next time.' : 'Batch complete. Image text is now searchable.')
    } catch (err) { if (alive.current && !cancelled.current) setError(message(err)) }
    finally {
      controller.abort(); jobController.current = null
      await worker.current?.terminate().catch(() => {}); worker.current = null
      if (remaining.length) await releaseMediaOcr({ data: remaining }).catch(() => {})
      if (alive.current) { setBusy(''); await refresh() }
    }
  }
  function stop() { cancelled.current = true; jobController.current?.abort(); setStatus('Pausing after the current request…'); void worker.current?.terminate().catch(() => {}) }
  async function remove(asset: MediaAsset) {
    const approved = await confirmAction({ title: 'Delete this file?', description: `Delete ${asset.name}? This cannot be undone. Files still used by content cannot be deleted.`, approveLabel: 'Delete file' })
    if (!approved) return
    setDeleting(asset.key); setError('')
    try { await deleteLibraryMedia({ data: { key: asset.key, etag: asset.etag } }); notify({ title: 'File deleted', variant: 'success' }); await refresh() }
    catch (err) { setError(message(err)) }
    finally { setDeleting('') }
  }
  async function copy(asset: MediaAsset) {
    try { await navigator.clipboard.writeText(new URL(asset.url, location.origin).href); setCopied(asset.key) }
    catch { setError('The file URL could not be copied. Open the file and copy its address.') }
  }
  const totalFor = (state: string) => Number(data.totals.find(item => item.status === state)?.count ?? 0)
  const pending = totalFor('pending') + totalFor('processing')
  return <div className="media-library">
    <div className="breadcrumb">Dashboard <span className="sep">/</span> <span className="here">Media Library</span></div>
    <header className="media-library-heading"><div><span className="media-eyebrow">YOUR CREATIVE LIBRARY</span><h1>Media Library</h1><p>Artwork, documents and subtitles, all in one place.</p></div><button type="button" className="media-primary" onClick={() => setUploadOpen(true)}><ImagePlus size={18}/>Upload media</button></header>
    {(!data.ok || error || listError) && <p className="media-error" role="alert">{error || listError || data.error}</p>}
    <section className="media-index-panel" aria-label="Image text index">
      <div><ScanText size={24}/><div><h2>Search the words in your images</h2><p>English text recognition runs on your device and saves the results. {totalFor('ready')} indexed · {pending} waiting · {totalFor('error')} need attention.</p><small>{data.scan?.finished ? `${data.scan.discovered} public files discovered. Refresh discovery after external uploads.` : 'Discover migrated and uploaded files in batches of up to 200. Progress is saved between visits.'} Upload dates use storage timestamps.</small></div></div>
      <div className="media-index-actions">
        <button type="button" className="media-secondary" disabled={!data.ok || Boolean(busy)} onClick={() => discover(Boolean(data.scan?.finished))}><RefreshCw size={16}/>{data.scan?.finished ? 'Refresh discovery' : 'Discover files'}</button>
        <button type="button" className="media-secondary" disabled={!data.ok || Boolean(busy) || !pending} onClick={() => indexImages()}><ScanText size={16}/>Index next {Math.min(OCR_BATCH_SIZE, pending) || OCR_BATCH_SIZE}</button>
        {totalFor('error') > 0 && <button type="button" className="media-secondary" disabled={Boolean(busy)} onClick={() => indexImages(true)}>Retry failed images</button>}
        {busy && <button type="button" className="media-secondary" onClick={stop}><Square size={14}/>Pause</button>}
      </div>
      {(status || busy) && <div className="media-job-status" role="status">{busy && <LoaderCircle className="media-spin" size={16}/>}<span>{status}</span>{busy === 'ocr' && <progress max="100" value={progress} aria-label="Current image recognition progress"/>}</div>}
    </section>
    <InteractiveFolderGallery folders={data.folders} selected={filters.folder ?? ''} onSelect={folder => change({ folder })}/>
    <form className="media-filter-bar" onSubmit={event => { event.preventDefault(); change({ query: draft }) }}>
      <label className="media-search"><Search size={19}/><span className="sr-only">Search media</span><input type="search" placeholder={filters.mode === 'filename' ? 'Search filenames' : 'Search text inside images'} value={draft} onChange={event => setDraft(event.target.value)}/>{draft && <button type="button" aria-label="Clear media search" onClick={() => { setDraft(''); change({ query: '' }) }}><X size={17}/></button>}<button type="submit">Search</button></label>
      <label><span>Search in</span><select value={filters.mode} onChange={event => change({ mode: event.target.value as 'text' | 'filename' })}><option value="text">Image text (OCR)</option><option value="filename">Filename</option></select></label>
      <label><span>Uploaded from</span><input type="date" value={filters.from ?? ''} onChange={event => change({ from: event.target.value })}/></label>
      <label><span>Uploaded to</span><input type="date" value={filters.to ?? ''} onChange={event => change({ to: event.target.value })}/></label>
      {(filters.from || filters.to || filters.query || filters.folder) && <button type="button" className="media-secondary" onClick={() => { setDraft(''); setFilters({ mode: filters.mode }) }}>Reset</button>}
    </form>
    <div className="media-results-heading"><h2>{filters.folder || 'All files'}</h2><span role="status">{loading ? 'Loading…' : `${data.total} files`}</span></div>
    {filters.query && filters.mode !== 'filename' && pending > 0 && <p className="media-search-note">Text search includes indexed images only. {pending} images are still waiting to be read.</p>}
    {data.ok && !data.assets.length && <div className="media-empty"><FolderSearch size={38}/><h3>{filters.query ? filters.mode === 'filename' ? 'No matching filenames' : 'No matching image text yet' : 'No files to show'}</h3><p>{filters.query ? filters.mode === 'filename' ? 'Try another filename or check the selected folder and dates.' : 'Try another word, check the dates, or index the remaining images.' : 'Discover your existing library or upload a new file to get started.'}</p></div>}
    <ul className="media-assets" aria-label="Stored media files" aria-busy={loading}>
      {data.assets.map(asset => <li key={asset.key}><article className="media-asset" aria-busy={deleting === asset.key}>
        <a className="media-asset-preview" href={asset.url} target="_blank" rel="noreferrer" aria-label={`Open ${asset.name}`}>{asset.kind === 'image' ? <img src={asset.url} alt={asset.name} loading="lazy"/> : <FileIcon size={40}/>}<span className="media-file-type">{asset.key.split('.').pop()?.toUpperCase()}</span></a>
        <div className="media-asset-info"><h3 title={asset.name}>{asset.name}</h3><p>{bytesLabel(asset.size)} · {asset.uploaded ? new Date(asset.uploaded).toLocaleDateString() : 'Date unavailable'}</p>
          <span className={'media-ocr-state ' + asset.ocr_status}>{asset.ocr_status === 'ready' ? asset.ocr_text ? 'Text indexed' : 'No text detected' : asset.ocr_status === 'pending' ? 'Text not indexed' : asset.ocr_status === 'processing' ? 'Indexing / awaiting resume' : asset.ocr_status === 'error' ? 'Indexing needs attention' : asset.kind === 'image' ? 'Too large for OCR' : 'OCR applies to images'}</span>
          {asset.ocr_error && <p className="media-asset-error">{asset.ocr_error}</p>}
          {asset.ocr_text && <details><summary>Recognized text</summary><p>{asset.ocr_text}</p></details>}
        </div>
        <footer><button type="button" className="media-secondary" onClick={() => copy(asset)}>{copied === asset.key ? <Check size={16}/> : <Copy size={16}/>} {copied === asset.key ? 'Copied' : 'Copy link'}</button><button type="button" className="media-icon-button" aria-label={`Delete ${asset.name}`} disabled={Boolean(deleting)} onClick={() => remove(asset)}><Trash2 size={17}/></button></footer>
      </article></li>)}
    </ul>
    {data.total > 48 && <nav className="media-pagination" aria-label="Media pages"><button type="button" className="media-secondary" disabled={!filters.offset || loading} onClick={() => change({ offset: Math.max(0, (filters.offset ?? 0) - 48) })}>Previous</button><span>Page {Math.floor((filters.offset ?? 0) / 48) + 1} of {Math.ceil(data.total / 48)}</span><button type="button" className="media-secondary" disabled={(filters.offset ?? 0) + 48 >= data.total || loading} onClick={() => change({ offset: (filters.offset ?? 0) + 48 })}>Next</button></nav>}
    <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} onUploaded={() => { setUploadOpen(false); void refresh() }} title="Add to your media library"/>
  </div>
}

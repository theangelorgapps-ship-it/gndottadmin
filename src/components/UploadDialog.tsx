import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCircle2, FileUp, File as FileIcon, FolderSearch, LoaderCircle, Search, Upload, X } from 'lucide-react'
import { listMediaLibrary } from '../lib/media-library'
import { mediaKind, type MediaAsset } from '../lib/media-library-core'
import { acceptsMedia, pickerKind } from '../lib/media-picker'
import { AdminImagePreview } from './Poster'
import '../media-library.css'

type Tab = 'current' | 'library' | 'upload'
export type UploadDialogProps = {
  open: boolean; onClose: () => void; onUploaded: (url: string) => void; accept?: string; title?: string
  currentValue?: string | null; defaultTab?: Tab
  target?: { endpoint: '/api/bunny-upload'; title: string; table?: 'entertainments' | 'videos'; rowId?: number }
}
/** Shared picker. Selection/upload calls onUploaded once; cancellation leaves the parent value intact. */
export function UploadDialog({ open, onClose, onUploaded, accept, title = 'Choose media', currentValue, defaultTab, target }: UploadDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null)
  const xhr = useRef<XMLHttpRequest | null>(null); const mounted = useRef(true); const titleId = useId(); const tabId = useId()
  const [clientReady, setClientReady] = useState(false)
  const [tab, setTab] = useState<Tab>('upload')
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState(0); const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState(''); const [dragging, setDragging] = useState(false)
  const [library, setLibrary] = useState<Awaited<ReturnType<typeof listMediaLibrary>> | null>(null)
  const [loading, setLoading] = useState(false); const [libraryError, setLibraryError] = useState('')
  const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [folder, setFolder] = useState(''); const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<MediaAsset | null>(null); const [retry, setRetry] = useState(0)
  const isVideo = Boolean(target)
  const accepted = accept ?? (isVideo ? 'video/*' : '.jpg,.jpeg,.png,.webp,.gif,.avif,.pdf,.vtt,.srt')
  const kind = pickerKind(accepted)
  useEffect(() => { setClientReady(true) }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; xhr.current?.abort() } }, [])
  useEffect(() => {
    if (!open) { xhr.current?.abort(); dialog.current?.close(); return }
    setFile(null); if (input.current) input.current.value = ''; setError(''); setProgress(0); setPhase('idle'); setDragging(false)
    setTab(isVideo ? 'upload' : defaultTab ?? (currentValue ? 'current' : 'library'))
    setSelected(null); setQuery(''); setSearch(''); setFolder(''); setOffset(0); setLibrary(null); setLibraryError('')
    const focused = document.activeElement as HTMLElement | null
    if (!dialog.current?.open) dialog.current?.showModal()
    return () => { dialog.current?.close(); focused?.focus() }
  }, [open, clientReady, isVideo, defaultTab])
  useEffect(() => {
    if (!open || isVideo || tab !== 'library') return
    let cancelled = false; setLoading(true); setLibraryError(''); setSelected(null)
    listMediaLibrary({ data: { query: search, mode: 'filename', kind, folder, offset } })
      .then(result => { if (!cancelled) { setLibrary(result); if (!result.ok) setLibraryError(result.error ?? 'The media library could not be loaded.') } })
      .catch(err => { if (!cancelled) setLibraryError(err instanceof Error ? err.message : 'The media library could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, isVideo, tab, search, kind, folder, offset, retry])
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(''); return }
    const url = URL.createObjectURL(file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function close() { xhr.current?.abort(); onClose() }
  function choose(next: File | undefined) {
    if (!next || phase === 'uploading') return
    const limit = (isVideo ? 500 : 10) * 1024 * 1024
    if (next.size > limit) { setError(`Choose a file smaller than ${isVideo ? '500' : '10'} MB.`); return }
    if (!isVideo && !acceptsMedia({ key: next.name, kind: mediaKind(next.name) }, accepted)) { setError('Choose a file of the accepted type.'); return }
    setFile(next); setPhase('idle'); setProgress(0); setError('')
  }
  function upload() {
    if (!file || xhr.current) return
    const form = new FormData(); form.append('file', file)
    if (target) { form.append('title', target.title); if (target.table) form.append('table', target.table); if (target.rowId) form.append('row_id', String(target.rowId)) }
    const request = new XMLHttpRequest(); xhr.current = request; setPhase('uploading'); setError('')
    request.upload.onprogress = event => { if (mounted.current && event.lengthComputable) setProgress(Math.min(100, Math.round(event.loaded / event.total * 100))) }
    request.onload = () => {
      if (xhr.current !== request) return
      xhr.current = null; if (!mounted.current) return
      let body: any; try { body = JSON.parse(request.responseText) } catch { body = null }
      const value = target ? body?.videoId : body?.url
      if (request.status >= 200 && request.status < 300 && body?.ok && typeof value === 'string' && value) {
        setProgress(100); setPhase('done'); onUploaded(value)
      } else { setPhase('idle'); setError(body?.error ?? `Upload failed (${request.status}). Please try again.`) }
    }
    request.onerror = () => { xhr.current = null; if (mounted.current) { setPhase('idle'); setError('The connection was interrupted. Please try again.') } }
    request.onabort = () => { xhr.current = null; if (mounted.current) { setPhase('idle'); setProgress(0) } }
    request.ontimeout = () => { xhr.current = null; if (mounted.current) { setPhase('idle'); setError('The upload timed out. Please try again.') } }
    request.open('POST', target?.endpoint ?? '/api/upload'); request.timeout = isVideo ? 900000 : 180000; request.send(form)
  }
  function changeTab(next: Tab) { if (phase !== 'uploading') { setTab(next); setError('') } }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys = ['current', 'library', 'upload'] as const
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
    if (next < 0 || phase === 'uploading') return
    event.preventDefault(); changeTab(keys[next]); document.getElementById(`${tabId}-${keys[next]}`)?.focus()
  }
  const visibleAssets = library?.assets.filter(asset => acceptsMedia(asset, accepted)) ?? []
  const currentIsImage = kind === 'image' || mediaKind(currentValue ?? '') === 'image'
  if (!clientReady || typeof document === 'undefined') return null
  return createPortal(<dialog ref={dialog} className={'media-upload-dialog' + (!isVideo ? ' media-picker-dialog' : '')} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }} onClick={event => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
  }}>
    <div className="media-upload-inner">
      <header><div><span className="media-eyebrow">GOODNEWS HALOBOX</span><h2 id={titleId}>{title}</h2></div><button type="button" className="media-icon-button" onClick={close} aria-label="Close media picker"><X size={20}/></button></header>
      {!isVideo && <div className="media-picker-tabs" role="tablist" aria-label="Choose media source">{(['current', 'library', 'upload'] as const).map((key, index) => <button key={key} type="button" role="tab" id={`${tabId}-${key}`} aria-controls={`${tabId}-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} disabled={phase === 'uploading'} onClick={() => changeTab(key)} onKeyDown={event => tabKeys(event, index)}>{key === 'current' ? 'Current' : key === 'library' ? 'Media Library' : 'Upload'}</button>)}</div>}
      <section role={isVideo ? undefined : 'tabpanel'} id={`${tabId}-panel-${tab}`} aria-labelledby={isVideo ? undefined : `${tabId}-${tab}`} className="media-picker-panel">
        {tab === 'current' && <>
          {currentValue ? <div className="media-current">{currentIsImage ? <AdminImagePreview url={currentValue} label="Current image" className="media-current-preview"/> : <FileIcon size={48} aria-hidden="true"/>}<strong>{currentIsImage ? 'Current image' : 'Current file'}</strong><p>{currentValue}</p></div> : <div className="media-empty"><FileIcon size={32}/><h3>No media selected</h3><p>Choose an existing file from Media Library or upload a new one.</p></div>}
          <footer><button type="button" className="media-secondary" onClick={() => changeTab('library')}>Browse media</button><button type="button" className="media-primary" onClick={close}>{currentValue ? 'Keep current' : 'Close'}</button></footer>
        </>}
        {tab === 'library' && <>
          <div className="media-picker-search" role="search"><label><Search size={17} aria-hidden="true"/><span className="sr-only">Search media filenames</span><input type="search" value={query} maxLength={160} placeholder="Search filenames…" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); setSearch(query); setOffset(0) } }}/></label><button type="button" className="media-secondary" disabled={loading} onClick={() => { setSearch(query); setOffset(0) }}>Search</button></div>
          <label className="media-picker-folder">Folder<select value={folder} onChange={event => { setFolder(event.target.value); setOffset(0) }}><option value="">All folders</option>{library?.folders.map(item => <option key={item.folder} value={item.folder}>{item.folder}</option>)}</select></label>
          {libraryError ? <div className="media-error" role="alert">{libraryError}<button type="button" className="media-secondary" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : loading ? <p className="media-picker-status" role="status"><LoaderCircle size={18} className="media-spin"/>Loading media…</p> : visibleAssets.length ? <ul className="media-picker-grid" aria-label="Choose an existing file">{visibleAssets.map(asset => <li key={asset.key}><button type="button" className={'media-picker-asset' + (selected?.key === asset.key ? ' selected' : '')} aria-pressed={selected?.key === asset.key} onClick={() => setSelected(asset)}><span className="media-picker-preview">{asset.kind === 'image' ? <img src={asset.url} alt="" loading="lazy"/> : <FileIcon size={30}/ >}{selected?.key === asset.key && <span className="media-picker-check"><Check size={17}/></span>}</span><strong title={asset.name}>{asset.name}</strong><small>{asset.folder} · {Math.max(1, Math.round(asset.size / 1024))} KB</small></button></li>)}</ul> : <div className="media-empty"><FolderSearch size={32}/><h3>No matching files</h3><p>{search || folder ? 'Try another filename or folder.' : 'Upload a file, or discover existing files from the Media Library page.'}</p></div>}
          {library && library.total > 48 && <nav className="media-pagination" aria-label="Media library pages"><button type="button" className="media-secondary" disabled={!offset || loading} onClick={() => setOffset(value => Math.max(0, value - 48))}>Previous</button><span>Page {Math.floor(offset / 48) + 1} of {Math.ceil(library.total / 48)}</span><button type="button" className="media-secondary" disabled={offset + 48 >= library.total || loading} onClick={() => setOffset(value => value + 48)}>Next</button></nav>}
          <footer><span className="media-selection-label" aria-live="polite">{selected ? selected.name : 'Select a file to use'}</span><button type="button" className="media-secondary" onClick={close}>Cancel</button><button type="button" className="media-primary" disabled={!selected || loading || Boolean(libraryError)} onClick={() => { if (selected) onUploaded(selected.url) }}><Check size={17}/>Use selected</button></footer>
        </>}
        {tab === 'upload' && <>
          <p className="media-picker-help">{isVideo ? 'Upload to your connected Bunny Stream library.' : 'Images are saved as AVIF. Documents and subtitles keep their original format.'}</p>
          <button type="button" className={'media-dropzone' + (dragging ? ' is-dragging' : '')} disabled={phase === 'uploading'} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}>
            {preview ? <img src={preview} alt="Selected file preview"/> : <FileUp size={38} aria-hidden="true"/>}
            <strong>{file ? file.name : 'Choose a file'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Tap to change` : `or drop it here · up to ${isVideo ? '500' : '10'} MB`}</span>
          </button>
          <input ref={input} type="file" hidden accept={accepted} onChange={event => choose(event.target.files?.[0])}/>
          {phase === 'uploading' && <div className="media-upload-progress" role="status"><progress max="100" value={progress} aria-label="File upload progress"/><span><LoaderCircle className="media-spin" size={16}/>{progress < 100 ? `Uploading ${progress}%` : isVideo ? 'Saving to Bunny Stream…' : 'Checking and saving your file…'}</span></div>}
          {phase === 'done' && <p className="media-success" role="status"><CheckCircle2 size={18}/>Upload complete</p>}
          {error && <p className="media-error" role="alert">{error}</p>}
          <footer><button type="button" className="media-secondary" onClick={close}>{phase === 'uploading' ? 'Cancel upload' : 'Cancel'}</button><button type="button" className="media-primary" disabled={!file || phase !== 'idle'} onClick={upload}><Upload size={17}/>{phase === 'done' ? 'Uploaded' : 'Upload file'}</button></footer>
        </>}
      </section>
    </div>
  </dialog>, document.body)
}

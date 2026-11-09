import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, FileUp, LoaderCircle, Upload, X } from 'lucide-react'
import '../media-library.css'

export type UploadDialogProps = {
  open: boolean; onClose: () => void; onUploaded: (url: string) => void; accept?: string; title?: string
  target?: { endpoint: '/api/bunny-upload'; title: string; table?: 'entertainments' | 'videos'; rowId?: number }
}
/** Shared, form-free modal. Success calls onUploaded once; only cancellation calls onClose. */
export function UploadDialog({ open, onClose, onUploaded, accept, title = 'Upload media', target }: UploadDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null); const input = useRef<HTMLInputElement>(null)
  const xhr = useRef<XMLHttpRequest | null>(null); const mounted = useRef(true); const titleId = useId()
  const [clientReady, setClientReady] = useState(false)
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState(0); const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState(''); const [dragging, setDragging] = useState(false)
  const isVideo = Boolean(target)
  const accepted = accept ?? (isVideo ? 'video/*' : '.jpg,.jpeg,.png,.webp,.gif,.avif,.pdf,.vtt,.srt')
  useEffect(() => { setClientReady(true) }, [])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; xhr.current?.abort() } }, [])
  useEffect(() => {
    if (!open) { xhr.current?.abort(); dialog.current?.close(); return }
    setFile(null); if (input.current) input.current.value = ''; setError(''); setProgress(0); setPhase('idle')
    const focused = document.activeElement as HTMLElement | null
    dialog.current?.showModal()
    return () => { dialog.current?.close(); focused?.focus() }
  }, [open, clientReady])
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
    setFile(next); setPhase('idle'); setProgress(0); setError('')
  }
  function upload() {
    if (!file || xhr.current) return
    const form = new FormData(); form.append('file', file)
    if (target) { form.append('title', target.title); if (target.table) form.append('table', target.table); if (target.rowId) form.append('row_id', String(target.rowId)) }
    const request = new XMLHttpRequest(); xhr.current = request; setPhase('uploading'); setError('')
    request.upload.onprogress = event => { if (mounted.current && event.lengthComputable) setProgress(Math.min(100, Math.round(event.loaded / event.total * 100))) }
    request.onload = () => {
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
  if (!clientReady || typeof document === 'undefined') return null
  return createPortal(<dialog ref={dialog} className="media-upload-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close() }} onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="media-upload-inner">
      <header><div><span className="media-eyebrow">GOODNEWS HALOBOX</span><h2 id={titleId}>{title}</h2></div><button type="button" className="media-icon-button" onClick={close} aria-label="Close upload"><X size={20}/></button></header>
      <p>{isVideo ? 'Upload to your connected Bunny Stream library.' : 'Images are saved as AVIF. Documents and subtitles keep their original format.'}</p>
      <button type="button" className={'media-dropzone' + (dragging ? ' is-dragging' : '')} disabled={phase === 'uploading'} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}>
        {preview ? <img src={preview} alt="Selected file preview"/> : <FileUp size={38} aria-hidden="true"/>}
        <strong>{file ? file.name : 'Choose a file'}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Tap to change` : `or drop it here · up to ${isVideo ? '500' : '10'} MB`}</span>
      </button>
      <input ref={input} type="file" hidden accept={accepted} onChange={event => choose(event.target.files?.[0])}/>
      {phase === 'uploading' && <div className="media-upload-progress" role="status"><progress max="100" value={progress}/><span><LoaderCircle className="media-spin" size={16}/>{progress < 100 ? `Uploading ${progress}%` : isVideo ? 'Saving to Bunny Stream…' : 'Checking and saving your file…'}</span></div>}
      {phase === 'done' && <p className="media-success" role="status"><CheckCircle2 size={18}/>Upload complete</p>}
      {error && <p className="media-error" role="alert">{error}</p>}
      <footer><button type="button" className="media-secondary" onClick={close}>{phase === 'uploading' ? 'Cancel upload' : 'Cancel'}</button><button type="button" className="media-primary" disabled={!file || phase !== 'idle'} onClick={upload}><Upload size={17}/>{phase === 'done' ? 'Uploaded' : 'Upload file'}</button></footer>
    </div>
  </dialog>, document.body)
}

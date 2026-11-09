import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Save } from 'lucide-react'
import { adminSaveHeroBanner } from '../lib/admin'
import { HERO_DEVICES, defaultFrame, validateHeroDesign, type HeroDesign, type HeroDevice } from '../lib/banner-design'
import { UploadDialog } from './UploadDialog'
import { img } from './Poster'
import '../banner-editor.css'

const types = { movie: 'Sermon', tvshow: 'Show', teaching: 'Teaching', video: 'Video' }
const placements = { home: 'Home', movie: 'Sermons', tv_show: 'Shows', teaching: 'Teachings', video: 'Videos' }
const sizes = { phone: [390, 650], tablet: [820, 620], web: [1920, 900], app: [390, 650] }
export function HeroBannerEditor({ row, contents, onClose, onSaved }: { row: any; contents: any[]; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [ready, setReady] = useState(false)
  const [device, setDevice] = useState<HeroDevice>('web')
  const [form, setForm] = useState({ id: row?.id as number | undefined, title: row?.title || '', type: row?.type || 'movie', type_id: Number(row?.type_id) || 0, banner_for: row?.banner_for || 'home', status: Number(row?.status ?? 1), file_url: row?.file_url || '', poster_url: row?.poster_url || '' })
  const [design, setDesign] = useState<HeroDesign>(() => {
    let saved: HeroDesign = { version: 1, devices: {} }
    try { saved = validateHeroDesign(JSON.parse(row?.design_json || '')) } catch { /* Legacy banners start with explicit canvas defaults. */ }
    for (const key of HERO_DEVICES) saved.devices[key] ??= defaultFrame()
    return saved
  })
  const [upload, setUpload] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const frame = design.devices[device] || defaultFrame()
  const selected = contents.find(item => item.id === form.type_id && item.type === form.type)
  const fallback = device === 'phone' || device === 'app' ? form.poster_url || selected?.poster_url || form.file_url : form.file_url || selected?.thumbnail_url || selected?.poster_url
  const updateFrame = (patch: Partial<typeof frame>) => setDesign(current => ({ version: 1, devices: { ...current.devices, [device]: { ...frame, ...patch } } }))
  useEffect(() => { setReady(true) }, [])
  useEffect(() => { if (ready) { const before = document.activeElement as HTMLElement; dialog.current?.showModal(); return () => { dialog.current?.close(); before?.focus() } } }, [ready])
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await adminSaveHeroBanner({ data: { ...form, design } }); onSaved() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the banner.'); setBusy(false) }
  }
  if (!ready) return null
  return createPortal(<dialog ref={dialog} className="hero-editor-dialog" aria-labelledby="hero-editor-title" onCancel={event => { event.preventDefault(); if (event.target === event.currentTarget && !busy && !upload) onClose() }}>
    <form onSubmit={save}>
      <header><div><span>GOODNEWS HALOBOX</span><h2 id="hero-editor-title">{form.id ? 'Edit hero' : 'Create hero'}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close hero editor"><X/></button></header>
      <div className="hero-editor-body">
        <section className="hero-canvas-section" aria-label="Responsive hero preview">
          <div className="hero-device-tabs" role="group" aria-label="Preview device">{HERO_DEVICES.map(key => <button type="button" key={key} aria-pressed={device === key} onClick={() => setDevice(key)}>{key === 'web' ? 'Website / 4K' : key[0].toUpperCase()+key.slice(1)}</button>)}</div>
          <div className="hero-editor-canvas" style={{ aspectRatio: `${sizes[device][0]}/${sizes[device][1]}` }}>
            {frame.image || fallback ? <img src={img(frame.image || fallback)} alt="Hero artwork preview" style={{ objectFit: frame.fit, objectPosition: `${frame.x}% ${frame.y}%` }}/> : <span className="hero-canvas-placeholder">Choose a title and artwork</span>}
            <div className="hero-canvas-copy" style={{ textAlign: frame.align, alignItems: frame.align === 'left' ? 'flex-start' : frame.align === 'right' ? 'flex-end' : 'center' }}><strong>{selected?.name || form.title || 'Your featured title'}</strong><span>{types[form.type as keyof typeof types]}</span><span className="hero-canvas-play">▶ Watch now</span></div>
          </div>
          <p className="hero-preview-caption">{sizes[device].join(' × ')} layout · Preview uses the saved crop and alignment.</p>
        </section>
        <section className="hero-editor-fields">
          <label>Banner name<input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <div className="hero-field-pair"><label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, type_id: 0 })}>{Object.entries(types).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Placement<select value={form.banner_for} onChange={e => setForm({ ...form, banner_for: e.target.value })}>{Object.entries(placements).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          <label>Featured title<select required value={form.type_id || ''} onChange={e => setForm({ ...form, type_id: Number(e.target.value) })}><option value="">Choose a title</option>{contents.filter(item => item.type === form.type).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Default website artwork<input value={form.file_url} onChange={e => setForm({ ...form, file_url: e.target.value })} placeholder="https://… or /media/…"/></label>
          <label>Default phone artwork<input value={form.poster_url} onChange={e => setForm({ ...form, poster_url: e.target.value })} placeholder="Use title artwork"/></label>
          <fieldset><legend>{device === 'web' ? 'Website' : device} layout</legend>
            <label>Artwork override<div className="hero-image-control"><input value={frame.image || ''} onChange={e => updateFrame({ image: e.target.value })} placeholder="Use default artwork"/><button type="button" onClick={() => setUpload(true)}><Upload size={16}/>Upload</button></div></label>
            <label>Horizontal focus · {frame.x}%<input aria-label="Horizontal image focus" type="range" min="0" max="100" value={frame.x} onChange={e => updateFrame({ x: Number(e.target.value) })}/></label>
            <label>Vertical focus · {frame.y}%<input aria-label="Vertical image focus" type="range" min="0" max="100" value={frame.y} onChange={e => updateFrame({ y: Number(e.target.value) })}/></label>
            <div className="hero-field-pair"><label>Image fit<select value={frame.fit} onChange={e => updateFrame({ fit: e.target.value as any })}><option value="cover">Fill frame</option><option value="contain">Fit whole image</option></select></label><label>Text alignment<select value={frame.align} onChange={e => updateFrame({ align: e.target.value as any })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label></div>
            <button type="button" onClick={() => setDesign(current => ({ version: 1, devices: { ...current.devices, [device]: defaultFrame() } }))}>Reset this layout</button>
          </fieldset>
          <label className="hero-active"><input type="checkbox" checked={form.status === 1} onChange={e => setForm({ ...form, status: e.target.checked ? 1 : 0 })}/>Published</label>
        </section>
      </div>
      <footer>{error && <p role="alert">{error}</p>}<button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="hero-editor-save" disabled={busy || !form.type_id}><Save size={16}/>{busy ? 'Saving…' : 'Save hero'}</button></footer>
    </form>
    <UploadDialog open={upload} onClose={() => setUpload(false)} onUploaded={url => { updateFrame({ image: url }); setUpload(false) }} accept="image/*" title="Upload hero artwork"/>
  </dialog>, document.body)
}

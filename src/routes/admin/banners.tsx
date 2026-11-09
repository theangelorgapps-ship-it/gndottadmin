import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { adminHeroBanners, adminHeroContentOptions, adminReorderHeroBanners, adminDeleteRow } from '../../lib/admin'
import { HeroBannerEditor } from '../../components/HeroBannerEditor'
import { heroArtwork } from '../../lib/banner-design'
import { img } from '../../components/Poster'
import '../../banner-editor.css'
import { useConfirm } from '../../lib/confirm'

const placements: Record<string, string> = { home: 'Home', movie: 'Sermons', teaching: 'Teachings', video: 'Videos', tv_show: 'Shows' }
export const Route = createFileRoute('/admin/banners')({ loader: async () => {
  const [rows, contents] = await Promise.all([adminHeroBanners(), adminHeroContentOptions()])
  return { rows, contents }
}, component: Page })
function Page() {
  const { rows, contents } = Route.useLoaderData() as any
  const router = useRouter()
  const confirm = useConfirm()
  const [query, setQuery] = useState(''), [placement, setPlacement] = useState('home'), [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null), [reordering, setReordering] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const group = rows.filter((row: any) => row.banner_for === placement)
  const displayed = group.filter((row: any) => `${row.title} ${row.title_name || ''}`.toLowerCase().includes(query.toLowerCase()))
  const pending = deleting !== null || reordering
  async function remove(row: any) {
    if (pending || !await confirm({ title: 'Delete this hero?', description: row.title, approveLabel: 'Delete hero' })) return
    setDeleting(row.id); setError('')
    try { await adminDeleteRow({ data: { entity: 'banners', id: row.id } }); await router.invalidate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete hero.') }
    finally { setDeleting(null) }
  }
  async function move(id: number, direction: number) {
    if (pending) return
    const ids = group.map((row: any) => row.id)
    const index = ids.indexOf(id), next = index + direction
    if (index < 0 || next < 0 || next >= ids.length) return
    const previous = ids[index]
    ids[index] = ids[next]
    ids[next] = previous
    setReordering(true); setError('')
    try { await adminReorderHeroBanners({ data: { placement, ids } }); await router.invalidate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save banner order.') }
    finally { setReordering(false) }
  }
  return <div className="hero-admin-page">
    <header><div><h1>Hero banners</h1><p>Manage the slides viewers see. Artwork follows the featured title unless you choose an override.</p></div><button disabled={pending} onClick={() => setEditing({ banner_for: placement })}><Plus size={18}/>Create hero</button></header>
    <div className="hero-banner-toolbar"><label className="hero-banner-search">Placement<select value={placement} disabled={pending} onChange={e => setPlacement(e.target.value)}>{Object.entries(placements).map(([key, label]) => <option key={key} value={key}>{label} ({rows.filter((row: any) => row.banner_for === key).length})</option>)}</select></label><label className="hero-banner-search">Search heroes<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
    <p className="hero-order-help">Use the arrows to change the saved slide order.{query ? ' Clear search to reorder slides.' : ''}</p>
    {error && <p role="alert">{error}</p>}{reordering && <p role="status">Saving slide order…</p>}
    <div className="hero-banner-grid">{displayed.map((row: any) => {
      const index = group.findIndex((item: any) => item.id === row.id)
      const artwork = heroArtwork('web', row, { thumbnail_url: row.title_thumbnail_url, poster_url: row.title_poster_url })
      return <article key={row.id}><img src={img(artwork)} alt={row.title || 'Hero artwork'}/><div><span className="hero-slide-number">Slide {index + 1}</span><h2>{row.title || 'Untitled banner'}</h2><p>{row.status ? row.title_status ? 'Published' : 'Waiting for title to be published' : 'Hidden'} · {row.file_url || row.poster_url ? 'Custom default artwork' : 'Follows title artwork'}</p>
        <div className="hero-banner-actions"><button aria-label={`Edit ${row.title || 'banner'}`} disabled={pending} onClick={() => setEditing(row)}><Pencil size={16}/>Edit hero</button><button aria-label={`Move ${row.title || 'banner'} earlier`} disabled={pending || !!query || index === 0} onClick={() => void move(row.id, -1)}><ArrowUp size={16}/></button><button aria-label={`Move ${row.title || 'banner'} later`} disabled={pending || !!query || index === group.length - 1} onClick={() => void move(row.id, 1)}><ArrowDown size={16}/></button><button aria-label={`Delete ${row.title || 'banner'}`} disabled={pending} onClick={() => void remove(row)}><Trash2 size={16}/>{deleting === row.id ? 'Deleting…' : 'Delete'}</button></div>
      </div></article>
    })}</div>
    {!displayed.length && <p>{query ? 'No matching heroes.' : `No ${placements[placement].toLowerCase()} heroes yet. Create a hero to feature a title.`}</p>}
    {editing && <HeroBannerEditor key={editing.id || 'new'} row={editing} contents={contents} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void router.invalidate() }}/>}
  </div>
}

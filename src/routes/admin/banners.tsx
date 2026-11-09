import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { adminHeroBanners, adminOptions, adminDeleteRow } from '../../lib/admin'
import { HeroBannerEditor } from '../../components/HeroBannerEditor'
import { img } from '../../components/Poster'
import '../../banner-editor.css'
import { useConfirm } from '../../lib/confirm'
export const Route = createFileRoute('/admin/banners')({ loader: async () => { const [rows, options] = await Promise.all([adminHeroBanners(), adminOptions()]); return { rows, options } }, component: Page })
function Page() {
  const { rows, options } = Route.useLoaderData() as any
  const router = useRouter()
  const confirm = useConfirm()
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [deleting, setDeleting] = useState<number | null>(null)
  async function remove(row: any) {
    if (deleting !== null || !await confirm({ title: 'Delete this hero?', description: row.title, approveLabel: 'Delete hero' })) return
    setDeleting(row.id); setError('')
    try { await adminDeleteRow({ data: { entity: 'banners', id: row.id } }); await router.invalidate() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete hero.') }
    finally { setDeleting(null) }
  }
  const [editing, setEditing] = useState<any>(null)
  const placements: Record<string,string> = { home:'Home',movie:'Sermons',tv_show:'Shows',teaching:'Teachings',video:'Videos' }
  return <div className="hero-admin-page"><header><div><h1>Hero banners</h1><p>Compose artwork for phones, tablets, the website and app.</p></div><button onClick={() => setEditing({})}><Plus size={18}/>Create hero</button></header>
    <label className="hero-banner-search">Search heroes<input type="search" value={query} onChange={e => setQuery(e.target.value)}/></label>{error && <p role="alert">{error}</p>}
    <div className="hero-banner-grid">{rows.filter((row:any) => `${row.title} ${placements[row.banner_for] || row.banner_for}`.toLowerCase().includes(query.toLowerCase())).map((row:any) => <article key={row.id}><img src={img(row.file_url || row.poster_url)} alt={row.title || 'Hero artwork'}/><div><h2>{row.title || 'Untitled banner'}</h2><p>{placements[row.banner_for] || row.banner_for} · {row.status ? 'Published' : 'Hidden'}{!row.design_json ? ' · Layout not configured' : ''}</p><button aria-label={`Edit ${row.title || 'banner'}`} onClick={() => setEditing(row)}><Pencil size={16}/>Edit hero</button><button aria-label={`Delete ${row.title || 'banner'}`} disabled={deleting !== null} onClick={() => void remove(row)}><Trash2 size={16}/>{deleting === row.id ? 'Deleting…' : 'Delete'}</button></div></article>)}</div>
    {!rows.length && <p>No hero banners yet. Create a hero to feature a title.</p>}
    {editing && <HeroBannerEditor key={editing.id || 'new'} row={editing} contents={options.contents} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void router.invalidate() }}/>}</div>
}

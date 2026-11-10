import { useEffect, useMemo, useState } from 'react'
import {
  adminAttachContentProduct, adminDetachContentProduct, adminListContentProducts, adminShopCatalogue,
  type ProductContentType, type ShopProductOption,
} from '../lib/content-products'
import { useToast } from '../lib/toast'

function money(p: ShopProductOption) {
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency }).format(Number(p.price) / 10 ** p.minorUnit) }
  catch { return p.price }
}

// Shared "Products" editor section: attach shop products to this record so the
// player's Recommended Resources expander can surface them.
export function ContentProductsPanel({ contentType, contentId, disabled }: {
  contentType: ProductContentType
  contentId?: number
  disabled?: boolean
}) {
  const notify = useToast()
  const [attached, setAttached] = useState<ShopProductOption[] | null>(null)
  const [catalogue, setCatalogue] = useState<ShopProductOption[] | null>(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    if (!contentId) return
    let cancelled = false
    adminListContentProducts({ data: { contentType, contentId } })
      .then(res => { if (!cancelled) setAttached(res.products) })
      .catch((e: any) => { if (!cancelled) notify({ title: 'Could not load products', description: e?.message ?? 'Please try again.', variant: 'destructive' }) })
    adminShopCatalogue()
      .then(res => { if (!cancelled) setCatalogue(res.products) })
      .catch(() => { if (!cancelled) setCatalogue([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, contentId])

  const attachable = useMemo(() => {
    if (!catalogue || !attached) return []
    const taken = new Set(attached.map(p => p.id))
    const query = search.trim().toLowerCase()
    return catalogue
      .filter(p => !taken.has(p.id))
      .filter(p => !query || p.name.toLowerCase().includes(query) || p.slug.includes(query))
      .slice(0, 12)
  }, [catalogue, attached, search])

  if (!contentId) {
    return <p className="text-sm text-muted-foreground">Save this record first, then attach products from the shop.</p>
  }

  async function attach(productId: number) {
    setBusyId(productId)
    try {
      await adminAttachContentProduct({ data: { contentType, contentId: contentId!, productId } })
      const res = await adminListContentProducts({ data: { contentType, contentId: contentId! } })
      setAttached(res.products)
      notify({ title: 'Product attached', description: 'It now appears under Recommended Resources for this title.', variant: 'success' })
    } catch (e: any) {
      notify({ title: 'Attach failed', description: e?.message ?? 'Please try again.', variant: 'destructive' })
    } finally { setBusyId(null) }
  }

  async function detach(productId: number) {
    setBusyId(productId)
    try {
      await adminDetachContentProduct({ data: { contentType, contentId: contentId!, productId } })
      setAttached(current => (current ?? []).filter(p => p.id !== productId))
      notify({ title: 'Product removed', variant: 'success' })
    } catch (e: any) {
      notify({ title: 'Remove failed', description: e?.message ?? 'Please try again.', variant: 'destructive' })
    } finally { setBusyId(null) }
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 16 }}>
      <div className="field min-w-0">
        <label>Attached products</label>
        {attached === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {attached?.length === 0 && <p className="text-sm text-muted-foreground">No products yet. Attached products appear under Recommended Resources in the player for this title.</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          {attached?.map(p => (
            <div key={p.id} className="check-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}>
              {p.image && <img src={p.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
              <span style={{ flex: 1, minWidth: 0 }}>{p.name} <small className="text-muted-foreground">· {money(p)}{p.inStock ? '' : ' · out of stock'}</small></span>
              <button type="button" className="btn btn-dark btn-sm" disabled={disabled || busyId === p.id} onClick={() => void detach(p.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
      <div className="field min-w-0">
        <label htmlFor={`product-search-${contentType}`}>Attach a product</label>
        <input id={`product-search-${contentType}`} placeholder="Search the shop catalogue…" value={search} disabled={disabled} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {catalogue === null && <p className="text-sm text-muted-foreground">Loading catalogue…</p>}
          {catalogue?.length === 0 && <p className="text-sm text-muted-foreground">The shop catalogue is unavailable right now.</p>}
          {attachable.map(p => (
            <div key={p.id} className="check-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8 }}>
              {p.image && <img src={p.image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
              <span style={{ flex: 1, minWidth: 0 }}>{p.name} <small className="text-muted-foreground">· {money(p)}</small></span>
              <button type="button" className="btn btn-primary btn-sm" disabled={disabled || busyId === p.id} onClick={() => void attach(p.id)}>{busyId === p.id ? 'Attaching…' : 'Attach'}</button>
            </div>
          ))}
          {catalogue && attached && attachable.length === 0 && catalogue.length > 0 && (
            <p className="text-sm text-muted-foreground">{search ? 'No products match that search.' : 'Every catalogue product is already attached.'}</p>
          )}
        </div>
      </div>
    </div>
  )
}

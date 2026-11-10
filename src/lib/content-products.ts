import { createServerFn } from '@tanstack/react-start'
import { all, run } from './db'
import { requireAdmin } from './admin'

// Recommended Resources: attach shop products (uebertangel.org WooCommerce,
// via the public Store API) to catalogue content. The public app's player
// reads the same content_products table to render the expander.

export const PRODUCT_CONTENT_TYPES = ['movie', 'video', 'episode', 'tvshow', 'teaching', 'live'] as const
export type ProductContentType = (typeof PRODUCT_CONTENT_TYPES)[number]

export type ShopProductOption = {
  id: number; name: string; slug: string; price: string; currency: string; minorUnit: number; image: string; inStock: boolean
}

const STORE_API = 'https://uebertangel.org/wp-json/wc/store/v1'
let catalogueCache: { until: number; products: ShopProductOption[] } | undefined

function projectProduct(p: any): ShopProductOption {
  return {
    id: p.id, name: String(p.name ?? '').replace(/<[^>]*>/g, ''), slug: p.slug ?? '',
    price: p.prices?.price ?? '0', currency: p.prices?.currency_code ?? 'GBP',
    minorUnit: p.prices?.currency_minor_unit ?? 2,
    image: p.images?.[0]?.src ?? '', inStock: !!p.is_in_stock,
  }
}

async function fetchCatalogue(refresh = false): Promise<ShopProductOption[]> {
  if (!refresh && catalogueCache && catalogueCache.until > Date.now()) return catalogueCache.products
  const fields = 'id,name,slug,prices,images,extensions,is_in_stock,type,is_purchasable'
  const rows: any[] = []
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`${STORE_API}/products?per_page=100&page=${page}&_fields=${fields}`, {
      headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('The store catalogue is unavailable. Please try again.')
    const batch = await response.json() as any[]
    if (!Array.isArray(batch)) throw new Error('The store catalogue is unavailable. Please try again.')
    rows.push(...batch)
    const pages = Number(response.headers.get('X-WP-TotalPages'))
    if (!Number.isSafeInteger(pages) || page >= pages) break
  }
  // Only bridge-enabled physical products are sellable through Halobox.
  const products = rows
    .filter(p => p.extensions?.halobox_bridge?.physical === true && ['simple', 'variable'].includes(p.type) && p.images?.length)
    .map(projectProduct)
  catalogueCache = { until: Date.now() + 120000, products }
  return products
}

function validContent(d: any): { contentType: ProductContentType; contentId: number } {
  if (!PRODUCT_CONTENT_TYPES.includes(d?.contentType)) throw new Error('Unknown content type.')
  if (typeof d?.contentId !== 'number' || !Number.isSafeInteger(d.contentId) || d.contentId < 1) throw new Error('Save this record first, then attach products.')
  return { contentType: d.contentType, contentId: d.contentId }
}

export const adminShopCatalogue = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  return { products: await fetchCatalogue() }
})

export const adminListContentProducts = createServerFn({ method: 'GET' })
  .validator(validContent)
  .handler(async ({ data }) => {
    await requireAdmin()
    const rows = await all<any>(`SELECT product_id, sort FROM content_products WHERE content_type=? AND content_id=? ORDER BY sort, product_id`, data.contentType, data.contentId)
    const catalogue = await fetchCatalogue().catch(() => [] as ShopProductOption[])
    const byId = new Map(catalogue.map(p => [p.id, p]))
    return { products: rows.map(r => byId.get(Number(r.product_id)) ?? { id: Number(r.product_id), name: `Product #${r.product_id}`, slug: '', price: '0', currency: 'GBP', minorUnit: 2, image: '', inStock: false }) }
  })

export const adminAttachContentProduct = createServerFn({ method: 'POST' })
  .validator((d: any) => {
    const c = validContent(d)
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { ...c, productId: d.productId }
  })
  .handler(async ({ data }) => {
    await requireAdmin()
    const catalogue = await fetchCatalogue()
    if (!catalogue.some(p => p.id === data.productId)) throw new Error('That product is not sellable through Halobox.')
    await run(`INSERT INTO content_products(content_type, content_id, product_id, sort) VALUES(?,?,?, COALESCE((SELECT MAX(sort)+1 FROM content_products WHERE content_type=? AND content_id=?), 0)) ON CONFLICT DO NOTHING`,
      data.contentType, data.contentId, data.productId, data.contentType, data.contentId)
    return { ok: true }
  })

export const adminDetachContentProduct = createServerFn({ method: 'POST' })
  .validator((d: any) => {
    const c = validContent(d)
    if (typeof d?.productId !== 'number' || !Number.isSafeInteger(d.productId) || d.productId < 1) throw new Error('Unknown product.')
    return { ...c, productId: d.productId }
  })
  .handler(async ({ data }) => {
    await requireAdmin()
    await run(`DELETE FROM content_products WHERE content_type=? AND content_id=? AND product_id=?`, data.contentType, data.contentId, data.productId)
    return { ok: true }
  })

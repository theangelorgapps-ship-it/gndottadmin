import { Link } from '@tanstack/react-router'

// The same published brand asset used by the public Halobox application.
export const HALOBOX_LOGO = 'https://halobox.tv/goodnews-halo-logo.avif'

export function AdminBrand({ compact = false, link = true, homeHref = '/admin' }: { compact?: boolean; link?: boolean; homeHref?: string }) {
  const content = <>
    <img className="halobox-brand-logo" src={HALOBOX_LOGO} width="44" height="44" alt="" />
    {!compact && <span className="brand-copy"><strong>GoodNews Halobox</strong><small>Admin workspace</small></span>}
  </>
  return link
    ? <Link to={homeHref as any} className="admin-brand" aria-label={homeHref === '/admin' ? 'GoodNews Halobox admin dashboard' : 'GoodNews Halobox live comments'}>{content}</Link>
    : <div className="admin-brand auth-brand" aria-label="GoodNews Halobox">{content}</div>
}

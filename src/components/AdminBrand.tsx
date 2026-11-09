import { Link } from '@tanstack/react-router'

// The same published brand asset used by the public Halobox application.
export const HALOBOX_LOGO = 'https://halobox.tv/goodnews-halo-logo.avif'

export function AdminBrand({ compact = false, link = true }: { compact?: boolean; link?: boolean }) {
  const content = <>
    <img className="halobox-brand-logo" src={HALOBOX_LOGO} width="44" height="44" alt="" />
    {!compact && <span className="brand-copy"><strong>GoodNews Halobox</strong><small>Admin workspace</small></span>}
  </>
  return link
    ? <Link to="/admin" search={{ from: undefined, to: undefined }} className="admin-brand" aria-label="GoodNews Halobox admin dashboard">{content}</Link>
    : <div className="admin-brand auth-brand" aria-label="GoodNews Halobox">{content}</div>
}

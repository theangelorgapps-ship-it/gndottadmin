import { createFileRoute, Outlet, Link, redirect, useRouterState } from '@tanstack/react-router'
import { getAdminSession } from '../lib/admin'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const admin = await getAdminSession()
    if (!admin) throw redirect({ to: '/login' })
    return { admin }
  },
  component: AdminLayout,
})

type SideItem = { to: string; label: string; children?: { to: string; label: string }[] }

const GROUPS: { title: string; items: SideItem[] }[] = [
  {
    title: 'Main',
    items: [
      { to: '/admin', label: 'Dashboard' },
      { to: '/admin/media-library', label: 'Media Library' },
    ],
  },
  {
    title: 'Media Management',
    items: [
      { to: '/admin/genres', label: 'Genres' },
      { to: '/admin/movies', label: 'Movies' },
      {
        to: '/admin/tv-shows',
        label: 'TV Shows',
        children: [
          { to: '/admin/seasons', label: 'Seasons' },
          { to: '/admin/episodes', label: 'Episodes' },
        ],
      },
      { to: '/admin/videos', label: 'Videos' },
      {
        to: '/admin/tv-category',
        label: 'Live TV',
        children: [{ to: '/admin/live-tv', label: 'TV Channel' }],
      },
      {
        to: '/admin/actors',
        label: 'Cast & Crew',
        children: [{ to: '/admin/directors', label: 'Directors' }],
      },
      {
        to: '/admin/vast-ads',
        label: 'Ads Manager',
        children: [{ to: '/admin/custom-ads', label: 'Custom Ads' }],
      },
    ],
  },
  {
    title: 'Subscription',
    items: [
      { to: '/admin/subscriptions', label: 'Subscriptions' },
      { to: '/admin/plans', label: 'Plans' },
      { to: '/admin/plan-limits', label: 'Plan Limits' },
      { to: '/admin/rent-history', label: 'Rent History' },
      { to: '/admin/coupons', label: 'Coupon' },
    ],
  },
  {
    title: 'Users',
    items: [
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/soon-to-expire', label: 'Soon-to-Expire' },
      { to: '/admin/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'System Setting',
    items: [
      { to: '/admin/banners', label: 'App Banner' },
      { to: '/admin/constants', label: 'Constants' },
      { to: '/admin/notification-templates', label: 'Notification Templates' },
      { to: '/admin/settings', label: 'Settings' },
      { to: '/admin/pages', label: 'Pages' },
      { to: '/admin/onboarding', label: 'Onboarding' },
      { to: '/admin/tax', label: 'Tax' },
      { to: '/admin/faq', label: 'FAQ' },
      { to: '/admin/language', label: 'Language Manager' },
      { to: '/admin/world', label: 'World' },
      { to: '/admin/currency', label: 'Currency' },
      { to: '/admin/countries', label: 'Countries' },
      { to: '/admin/access-control', label: 'Access Control' },
    ],
  },
]

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="brand-row">
          <img src="/default-image.jpg" alt="Streamit" />
          <a href="https://gndott.theangelorgapps.workers.dev" className="back-pill" aria-label="Back to site">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M19 12H5m6-7l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
        {GROUPS.map((g) => (
          <div className="side-group" key={g.title}>
            <div className="side-title">{g.title}</div>
            {g.items.map((it) => (
              <div key={it.to}>
                <Link
                  to={it.to}
                  className={pathname === it.to ? 'active' : ''}
                >
                  {it.label}
                </Link>
                {it.children?.map((c) => (
                  <Link
                    key={c.to}
                    to={c.to}
                    className={`side-sub ${pathname === c.to ? 'active' : ''}`}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div className="admin-body">
        <div className="admin-topbar">
          <span className="lang-pill">EN</span>
          <img className="avatar" src="/default-image.jpg" alt={admin.email} />
        </div>
        <div className="admin-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

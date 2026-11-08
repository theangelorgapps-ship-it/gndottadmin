import { createFileRoute, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import React, { useState } from 'react'
import {
  LayoutDashboard, Library, Tags, Church, Tv, ListVideo, PlaySquare,
  Radio, MonitorPlay, Users, Megaphone, BadgePercent, Crown,
  Layers, SlidersHorizontal, Receipt, TicketPercent, UserRound, Hourglass,
  GraduationCap, Image, Braces, Bell, Settings, FileText, Rocket, Percent, CircleHelp,
  Languages, Globe, DollarSign, MapPinned, ShieldCheck,
} from 'lucide-react'
import { getAdminSession } from '../lib/admin'
import { Sidebar, SidebarBody, SidebarLink } from '../components/ui/sidebar'
import { ToastProvider } from '../lib/toast'
import { ConfirmProvider } from '../lib/confirm'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const admin = await getAdminSession()
    if (!admin) throw redirect({ to: '/login' })
    return { admin }
  },
  component: AdminLayout,
})

type SideItem = {
  to: string
  label: string
  icon: React.ReactNode
  children?: { to: string; label: string; icon: React.ReactNode }[]
}

const ICON = 'h-[1.125rem] w-[1.125rem] flex-shrink-0'
const SUB_ICON = 'h-4 w-4 flex-shrink-0'

const GROUPS: { title: string; items: SideItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> },
      { to: '/admin/media-library', label: 'Media Library', icon: <Library className={ICON} /> },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/genres', label: 'Genres', icon: <Tags className={ICON} /> },
      { to: '/admin/movies', label: 'Sermons', icon: <Church className={ICON} /> },
      {
        to: '/admin/tv-shows',
        label: 'Shows',
        icon: <Tv className={ICON} />,
        children: [
          { to: '/admin/series', label: 'Series', icon: <Layers className={SUB_ICON} /> },
          { to: '/admin/episodes', label: 'Episodes', icon: <ListVideo className={SUB_ICON} /> },
        ],
      },
      {
        to: '/admin/teaching',
        label: 'Teachings',
        icon: <GraduationCap className={ICON} />,
        children: [
          { to: '/admin/teaching-volumes', label: 'Volumes (Series)', icon: <Layers className={SUB_ICON} /> },
          { to: '/admin/teaching-episodes', label: 'Episodes', icon: <ListVideo className={SUB_ICON} /> },
        ],
      },
      { to: '/admin/videos', label: 'Videos', icon: <PlaySquare className={ICON} /> },
      {
        to: '/admin/tv-category',
        label: 'Live TV',
        icon: <Radio className={ICON} />,
        children: [{ to: '/admin/live-tv', label: 'TV Channels', icon: <MonitorPlay className={SUB_ICON} /> }],
      },
      {
        to: '/admin/actors',
        label: 'Personalities',
        icon: <Users className={ICON} />,
      },
      { to: '/admin/locations', label: 'Locations', icon: <MapPinned className={ICON} /> },
      {
        to: '/admin/vast-ads',
        label: 'Ads Manager',
        icon: <Megaphone className={ICON} />,
        children: [{ to: '/admin/custom-ads', label: 'Custom Ads', icon: <BadgePercent className={SUB_ICON} /> }],
      },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: <Crown className={ICON} /> },
      { to: '/admin/plans', label: 'Plans', icon: <Layers className={ICON} /> },
      { to: '/admin/plan-limits', label: 'Plan Limits', icon: <SlidersHorizontal className={ICON} /> },
      { to: '/admin/rent-history', label: 'Rent History', icon: <Receipt className={ICON} /> },
      { to: '/admin/coupons', label: 'Coupons', icon: <TicketPercent className={ICON} /> },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/admin/users', label: 'Users', icon: <UserRound className={ICON} /> },
      { to: '/admin/soon-to-expire', label: 'Soon to Expire', icon: <Hourglass className={ICON} /> },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/banners', label: 'App Banners', icon: <Image className={ICON} /> },
      { to: '/admin/constants', label: 'Constants', icon: <Braces className={ICON} /> },
      { to: '/admin/notification-templates', label: 'Notification Templates', icon: <Bell className={ICON} /> },
      { to: '/admin/settings', label: 'Settings', icon: <Settings className={ICON} /> },
      { to: '/admin/pages', label: 'Pages', icon: <FileText className={ICON} /> },
      { to: '/admin/onboarding', label: 'Onboarding', icon: <Rocket className={ICON} /> },
      { to: '/admin/tax', label: 'Tax', icon: <Percent className={ICON} /> },
      { to: '/admin/faq', label: 'FAQ', icon: <CircleHelp className={ICON} /> },
      { to: '/admin/language', label: 'Language Manager', icon: <Languages className={ICON} /> },
      { to: '/admin/world', label: 'World', icon: <Globe className={ICON} /> },
      { to: '/admin/currency', label: 'Currency', icon: <DollarSign className={ICON} /> },
      { to: '/admin/countries', label: 'Countries', icon: <MapPinned className={ICON} /> },
      { to: '/admin/access-control', label: 'Access Control', icon: <ShieldCheck className={ICON} /> },
    ],
  },
]

function Logo() {
  return (
    <Link to={"/admin" as any} className="admin-brand" aria-label="GoodNews Halobox admin dashboard">
      <span className="brand-mark" aria-hidden="true">GH</span>
      <span className="brand-copy">
        <strong>GoodNews Halobox</strong>
        <small>Admin workspace</small>
      </span>
    </Link>
  )
}

function currentSection(pathname: string) {
  if (pathname.startsWith('/admin/user/')) return 'Users'
  for (const group of GROUPS) {
    for (const item of group.items) {
      const child = item.children?.find((entry) => entry.to === pathname)
      if (child) return child.label
      if (item.to === pathname) return item.label
    }
  }
  return 'Admin workspace'
}

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [open, setOpen] = useState(true)
  const section = currentSection(pathname)
  const initial = admin.email.trim().charAt(0).toUpperCase() || 'A'

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="admin-shell">
          <a className="skip-link" href="#main-content">Skip to content</a>
          <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="admin-sidebar">
              <Logo />
              <nav className="admin-nav" aria-label="Admin sections">
                {GROUPS.map((group) => (
                  <section className="nav-group" key={group.title} aria-label={group.title}>
                    <h2 className="side-caption">{group.title}</h2>
                    {group.items.map((item) => {
                      const childActive = item.children?.some((child) => pathname === child.to) ?? false
                      return (
                        <React.Fragment key={item.to}>
                          <SidebarLink
                            link={{ label: item.label, href: item.to, icon: item.icon }}
                            active={childActive}
                          />
                          {item.children?.map((child) => (
                            <SidebarLink
                              key={child.to}
                              link={{ label: child.label, href: child.to, icon: child.icon }}
                              className="sidebar-sub-link"
                            />
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </section>
                ))}
              </nav>
              <div className="sidebar-account">
                <span className="sidebar-account-icon" aria-hidden="true"><UserRound /></span>
                <span className="sidebar-account-copy sidebar-label">
                  <small>Signed in as</small>
                  <span title={admin.email}>{admin.email}</span>
                </span>
              </div>
            </SidebarBody>
          </Sidebar>
          <div className="admin-body">
            <header className="admin-topbar">
              <div className="topbar-context">
                <span>GoodNews Halobox</span>
                <strong>{section}</strong>
              </div>
              <div className="topbar-account">
                <span className="topbar-avatar" aria-hidden="true">{initial}</span>
                <span className="topbar-email" title={admin.email}>{admin.email}</span>
              </div>
            </header>
            <main className="admin-main" id="main-content">
              <Outlet />
            </main>
          </div>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}

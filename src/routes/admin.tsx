import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Library, Tags, Church, Tv, ListVideo, PlaySquare,
  Radio, MonitorPlay, Users, Clapperboard, Megaphone, BadgePercent, Crown,
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

type SideItem = { to: string; label: string; icon: React.ReactNode; children?: { to: string; label: string; icon: React.ReactNode }[] }

const ICON = 'h-5 w-5 flex-shrink-0 text-neutral-400'
const SUB_ICON = 'h-4 w-4 flex-shrink-0 text-neutral-500'

const GROUPS: { title: string; items: SideItem[] }[] = [
  {
    title: 'Main',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> },
      { to: '/admin/media-library', label: 'Media Library', icon: <Library className={ICON} /> },
    ],
  },
  {
    title: 'Media Management',
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
        label: 'Teaching',
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
        children: [{ to: '/admin/live-tv', label: 'TV Channel', icon: <MonitorPlay className={SUB_ICON} /> }],
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
    title: 'Subscription',
    items: [
      { to: '/admin/subscriptions', label: 'Subscriptions', icon: <Crown className={ICON} /> },
      { to: '/admin/plans', label: 'Plans', icon: <Layers className={ICON} /> },
      { to: '/admin/plan-limits', label: 'Plan Limits', icon: <SlidersHorizontal className={ICON} /> },
      { to: '/admin/rent-history', label: 'Rent History', icon: <Receipt className={ICON} /> },
      { to: '/admin/coupons', label: 'Coupon', icon: <TicketPercent className={ICON} /> },
    ],
  },
  {
    title: 'Users',
    items: [
      { to: '/admin/users', label: 'Users', icon: <UserRound className={ICON} /> },
      { to: '/admin/soon-to-expire', label: 'Soon-to-Expire', icon: <Hourglass className={ICON} /> },
    ],
  },
  {
    title: 'System Setting',
    items: [
      { to: '/admin/banners', label: 'App Banner', icon: <Image className={ICON} /> },
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

const Logo = () => (
  <a
    href="https://gndott.theangelorgapps.workers.dev"
    className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
  >
    <img src="/default-image.jpg" alt="Streamit" className="h-7 w-7 rounded-md object-cover flex-shrink-0" />
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="font-semibold text-white whitespace-pre"
    >
      Streamit Admin
    </motion.span>
  </a>
)

const LogoIcon = () => (
  <a
    href="https://gndott.theangelorgapps.workers.dev"
    className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20"
  >
    <img src="/default-image.jpg" alt="Streamit" className="h-7 w-7 rounded-md object-cover flex-shrink-0" />
  </a>
)

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)

  const linkClass = (to: string) =>
    `rounded-md px-1 ${pathname === to ? 'bg-white/10' : ''}`
  const subLinkClass = (to: string) =>
    `rounded-md px-1 pl-3 opacity-80 ${pathname === to ? 'bg-white/10 opacity-100' : ''}`

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="admin-shell">
          <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between gap-2 bg-[#0d151c] border-r border-[rgba(255,255,255,0.08)] sticky top-0 h-screen">
              <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {open ? <Logo /> : <LogoIcon />}
                <div className="mt-4 flex flex-col gap-0.5">
                  {GROUPS.map((g) => (
                    <div key={g.title}>
                      {open && <div className="side-caption">{g.title}</div>}
                      {g.items.map((it) => (
                        <React.Fragment key={it.to}>
                          <SidebarLink
                            link={{ label: it.label, href: it.to, icon: it.icon }}
                            className={linkClass(it.to)}
                          />
                          {it.children?.map((c) => (
                            <SidebarLink
                              key={c.to}
                              link={{ label: c.label, href: c.to, icon: c.icon }}
                              className={subLinkClass(c.to)}
                            />
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SidebarLink
                  link={{
                    label: admin.email,
                    href: '/admin/settings',
                    icon: (
                      <img
                        src="/default-image.jpg"
                        className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                        alt={admin.email}
                      />
                    ),
                  }}
                />
              </div>
            </SidebarBody>
          </Sidebar>
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
      </ConfirmProvider>
    </ToastProvider>
  )
}

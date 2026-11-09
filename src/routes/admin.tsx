import { createFileRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import React from 'react'
import {
  LayoutDashboard, Library, Tags, Church, Tv, ListVideo, PlaySquare,
  Radio, MonitorPlay, Users, Megaphone, BadgePercent, Crown,
  Layers, SlidersHorizontal, Receipt, TicketPercent, UserRound, Hourglass,
  GraduationCap, Image, Braces, Bell, Settings, FileText, Rocket, Percent, CircleHelp,
  Languages, Globe, DollarSign, MapPinned, ShieldCheck, MessagesSquare, CloudUpload, FileSpreadsheet,
} from 'lucide-react'
import { getWorkspaceSession } from '../lib/live-moderation'
import { SidebarWithTabs } from '../components/ui/sidebar-with-chrome-like-tabs'
import { ToastProvider } from '../lib/toast'
import { ConfirmProvider } from '../lib/confirm'
import { AdminBrand } from '../components/AdminBrand'
import { AdminProfileMenu } from '../components/AdminProfileMenu'
import { IngestProvider } from '../lib/ingest'
import { IngestWidget } from '../components/IngestWidget'
import '../admin-polish.css'
import '../admin-shell.css'

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const admin = await getWorkspaceSession()
    if (!admin) throw redirect({ to: '/login' })
    if (admin.workspaceRole === 'moderator' && location.pathname !== '/admin/live-comments') {
      throw redirect({ href: '/admin/live-comments' })
    }
    return { admin }
  },
  component: AdminLayout,
})

type SideItem = {
  to: string
  label: string
  icon: React.ReactNode
  children?: { to: string; label: string; tabLabel?: string; icon: React.ReactNode }[]
}

const ICON = 'h-[1.125rem] w-[1.125rem] flex-shrink-0'
const SUB_ICON = 'h-4 w-4 flex-shrink-0'

const GROUPS: { title: string; items: SideItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ICON} /> },
      { to: '/admin/media-library', label: 'Media Library', icon: <Library className={ICON} /> },
      { to: '/admin/media-ingest', label: 'Media Ingest', icon: <CloudUpload className={ICON} /> },
      { to: '/admin/bulk-upload', label: 'Bulk Upload', icon: <FileSpreadsheet className={ICON} /> },
      { to: '/admin/live-comments', label: 'Live Comments', icon: <MessagesSquare className={ICON} /> },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/genres', label: 'Categories', icon: <Tags className={ICON} /> },
      { to: '/admin/movies', label: 'Sermons', icon: <Church className={ICON} /> },
      {
        to: '/admin/tv-shows',
        label: 'Shows',
        icon: <Tv className={ICON} />,
        children: [
          { to: '/admin/series', label: 'Series', tabLabel: 'Show Series', icon: <Layers className={SUB_ICON} /> },
          { to: '/admin/episodes', label: 'Episodes', tabLabel: 'Show Episodes', icon: <ListVideo className={SUB_ICON} /> },
        ],
      },
      {
        to: '/admin/teaching',
        label: 'Teachings',
        icon: <GraduationCap className={ICON} />,
        children: [
          { to: '/admin/teaching-volumes', label: 'Volumes (Series)', tabLabel: 'Teaching Volumes', icon: <Layers className={SUB_ICON} /> },
          { to: '/admin/teaching-episodes', label: 'Episodes', tabLabel: 'Teaching Episodes', icon: <ListVideo className={SUB_ICON} /> },
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

const MODERATOR_GROUPS = [{ title: 'Moderation', items: GROUPS[0].items.filter(item => item.to === '/admin/live-comments') }]

function AdminLayout() {
  const { admin } = Route.useRouteContext()
  const navigating = useRouterState({ select: (state) => state.isLoading })
  const moderator = admin.workspaceRole === 'moderator'

  const shell = (
    <SidebarWithTabs
      key={`${admin.id}:${admin.workspaceRole}`}
      storageKey={`halobox:workspace-tabs:v1:${admin.id}:${admin.workspaceRole}`}
      groups={moderator ? MODERATOR_GROUPS : GROUPS}
      brand={<AdminBrand homeHref={moderator ? '/admin/live-comments' : '/admin'} />}
      account={<AdminProfileMenu admin={admin} />}
      navigating={navigating}
      footer={<div className="sidebar-account">
            <span className="sidebar-account-icon" aria-hidden="true"><UserRound /></span>
            <span className="sidebar-account-copy sidebar-label">
              <small>{moderator ? 'Channel moderator' : 'Signed in as'}</small>
              <span title={admin.email}>{admin.email}</span>
            </span>
          </div>}
    ><Outlet /></SidebarWithTabs>
  )

  return (
    <ToastProvider>
      <ConfirmProvider>
        {moderator ? shell : (
          <IngestProvider>
            {shell}
            <IngestWidget />
          </IngestProvider>
        )}
      </ConfirmProvider>
    </ToastProvider>
  )
}

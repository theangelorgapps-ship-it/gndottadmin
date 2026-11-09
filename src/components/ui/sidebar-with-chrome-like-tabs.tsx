import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, GripVertical, MoreHorizontal, Plus, X } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { Sidebar, SidebarBody, SidebarLink } from './sidebar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu'

export type NavItem = { to: string; label: string; tabLabel?: string; icon: ReactNode; children?: NavItem[] }
export type NavGroup = { title: string; items: NavItem[] }

export type SidebarWithTabsProps = {
  groups: NavGroup[]
  storageKey: string
  brand: ReactNode
  account: ReactNode
  footer?: ReactNode
  children: ReactNode
  navigating?: boolean
}

type WorkspaceTab = { id: string; href: string }

function ChromeTab({ tab, active, label, children }: { tab: WorkspaceTab; active: boolean; label: string; children: ReactNode }) {
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  return <Reorder.Item as="li" value={tab} dragListener={false} dragControls={dragControls} className="workspace-tab" role="presentation" data-active={active} transition={reducedMotion ? { duration: 0 } : { duration: .16 }} whileDrag={{ zIndex: 5 }}>
    <button type="button" tabIndex={-1} className="workspace-tab-drag" aria-label={`Drag ${label} tab to reorder`} title="Drag to reorder. Use Alt + arrow keys on a tab for keyboard reordering." onPointerDown={event => dragControls.start(event)}><GripVertical aria-hidden="true" /></button>
    {children}
  </Reorder.Item>
}

export function SidebarWithTabs({ groups, storageKey, brand, account, footer, children, navigating = false }: SidebarWithTabsProps) {
  const router = useRouter()
  const href = useRouterState({ select: state => state.location.href })
  const pathname = useRouterState({ select: state => state.location.pathname })
  const navItems = useMemo(() => groups.flatMap(group => group.items.flatMap(item => [item, ...(item.children ?? [])])), [groups])
  const [expanded, setExpanded] = useState(true)
  const [tabs, setTabsState] = useState<WorkspaceTab[]>([{ id: 'initial', href }])
  const tabsRef = useRef(tabs)
  function setTabs(next: WorkspaceTab[]) { tabsRef.current = next; setTabsState(next) }
  const [activeId, setActiveId] = useState('initial')
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>())
  const nextId = useRef(0)
  const [navigationError, setNavigationError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null)
  const allowedPaths = navItems.map(item => item.to).join('|')
  const activeIndex = tabs.findIndex(tab => tab.id === activeId)

  const describe = (tabHref: string) => {
    const path = tabHref.split(/[?#]/)[0].replace(/\/$/, '')
    const nav = navItems.find(item => item.to === path)
    if (nav) return { ...nav, label: nav.tabLabel ?? nav.label }
    if (path.startsWith('/admin/user/')) return { ...navItems.find(item => item.to === '/admin/users')!, label: 'User details' }
    return { label: 'Admin workspace', icon: null }
  }

  useEffect(() => {
    // Storage is an untrusted preference, never a source of route authority.
    // The URL wins on refresh/direct links; tabs are scoped to the signed-in account.
    let restored: WorkspaceTab[] = [{ id: 'initial', href }]
    let selected = 'initial'
    let expanded = true
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      const paths = new Set(allowedPaths.split('|'))
      const ids = new Set<string>()
      const validHref = (value: unknown): value is string => {
        if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/admin') || /[\\\u0000-\u001f]/.test(value)) return false
        const url = new URL(value, 'https://workspace.invalid')
        const path = url.pathname.replace(/\/$/, '')
        return url.origin === 'https://workspace.invalid' && (paths.has(path) || (paths.has('/admin/users') && /^\/admin\/user\/\d+$/.test(path)))
      }
      if (saved?.version === 1 && Array.isArray(saved.tabs)) {
        const valid: WorkspaceTab[] = saved.tabs.filter((tab: unknown): tab is WorkspaceTab => {
          if (!tab || typeof tab !== 'object') return false
          const { id, href } = tab as WorkspaceTab
          if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id) || !validHref(href)) return false
          ids.add(id); return true
        }).slice(0, 24).map(({ id, href }: WorkspaceTab) => ({ id, href }))
        if (valid.length) {
          restored = valid
          selected = valid.find(tab => tab.href === href)?.id || valid.find(tab => tab.id === saved.activeId)?.id || valid[0].id
          restored = valid.map(tab => tab.id === selected ? { ...tab, href } : tab)
        }
        expanded = saved.expanded !== false
      }
    } catch { /* Blocked or invalid storage must not prevent navigation. */ }
    setTabs(restored)
    activeIdRef.current = selected
    setActiveId(selected)
    setExpanded(expanded)
    setLoadedStorageKey(storageKey)
    // href is intentionally read only on account/permission restoration.
    // Normal URL changes are reconciled by the route effect below.
  }, [storageKey, allowedPaths])

  useEffect(() => {
    if (loadedStorageKey !== storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, tabs, activeId, expanded })) }
    catch { /* Private browsing/storage limits leave the live workspace usable. */ }
  }, [storageKey, loadedStorageKey, tabs, activeId, expanded])

  useEffect(() => {
    const current = tabsRef.current.find(tab => tab.id === activeIdRef.current)
    const match = current?.href === href ? current : tabsRef.current.find(tab => tab.href === href)
    if (match) { activeIdRef.current = match.id; setActiveId(match.id) }
    else setTabs(tabsRef.current.map(tab => tab.id === activeIdRef.current ? { ...tab, href } : tab))
  }, [href])

  async function activate(tab: WorkspaceTab) {
    setActiveId(tab.id)
    activeIdRef.current = tab.id
    setNavigationError('')
    try { await router.navigate({ href: tab.href }) }
    catch { setNavigationError('This page could not be opened. Choose a tab to try again.') }
  }

  function addTab(to: string) {
    if (tabsRef.current.length >= 24) return
    const tab = { id: `tab-${Date.now()}-${++nextId.current}`, href: to }
    setTabs([...tabsRef.current, tab])
    void activate(tab)
  }

  function focusTab(id: string) {
    requestAnimationFrame(() => tabRefs.current.get(id)?.focus())
  }

  function closeTab(id: string) {
    const currentTabs = tabsRef.current
    if (currentTabs.length <= 1) return
    const index = currentTabs.findIndex(tab => tab.id === id)
    if (index < 0) return
    const remaining = currentTabs.filter(tab => tab.id !== id)
    setTabs(remaining)
    const selected = id === activeIdRef.current ? remaining[Math.min(index, remaining.length - 1)] : remaining.find(tab => tab.id === activeIdRef.current)!
    if (id === activeIdRef.current) void activate(selected)
    focusTab(selected.id)
  }

  function moveTab(id: string, direction: -1 | 1) {
    const current = tabsRef.current
    const index = current.findIndex(tab => tab.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    const next = [...current]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    setTabs(next)
    setAnnouncement(`${describe(moved.href).label} moved to position ${target + 1} of ${next.length}.`)
    focusTab(id)
  }

  function keepTabs(remaining: WorkspaceTab[]) {
    if (!remaining.length) return
    setTabs(remaining)
    focusTab(activeIdRef.current)
  }

  useEffect(() => {
    tabRefs.current.get(activeId)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeId, href])

  return <div className="admin-shell admin-polished halobox-workspace">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Sidebar open={expanded} setOpen={setExpanded}>
      <SidebarBody className="admin-sidebar" mobileBrand={brand}>
        {brand}
        <nav className="admin-nav" aria-label="Admin sections">
          {groups.map(group => <section className="nav-group" key={group.title} aria-label={group.title}>
            <h2 className="side-caption">{group.title}</h2>
            {group.items.map(item => <Fragment key={item.to}>
              <SidebarLink link={{ label: item.label, href: item.to, icon: item.icon }} active={item.children?.some(child => child.to === pathname)} />
              {item.children?.map(child => <SidebarLink key={child.to} link={{ label: child.label, href: child.to, icon: child.icon }} className="sidebar-sub-link" />)}
            </Fragment>)}
          </section>)}
        </nav>
        {footer}
      </SidebarBody>
    </Sidebar>
    <div className="admin-body">
      <div className="workspace-tabs-bar">
        <div className="workspace-tabs-scroll">
          <Reorder.Group as="ol" axis="x" values={tabs} onReorder={setTabs} className="workspace-tabs" role="tablist" aria-label="Workspace tabs" aria-describedby="workspace-tab-instructions">
            {tabs.map(tab => <ChromeTab key={tab.id} tab={tab} active={tab.id === activeId} label={describe(tab.href).label}>
              <a href={tab.href} role="tab" id={`workspace-tab-${tab.id}`} aria-selected={tab.id === activeId} aria-controls="workspace-tab-panel" tabIndex={tab.id === activeId ? 0 : -1} className="workspace-tab-link" ref={element => { if (element) tabRefs.current.set(tab.id, element); else tabRefs.current.delete(tab.id) }} onClick={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
                event.preventDefault(); void activate(tab)
              }} onAuxClick={event => { if (event.button === 1) { event.preventDefault(); closeTab(tab.id) } }} onKeyDown={event => {
                const index = tabs.findIndex(item => item.id === tab.id)
                if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); moveTab(tab.id, event.key === 'ArrowRight' ? 1 : -1) }
                else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); closeTab(tab.id) }
                else if (event.key === ' ') { event.preventDefault(); void activate(tab) }
                else if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault()
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
                  tabRefs.current.get(tabs[next].id)?.focus()
                }
              }}><span aria-hidden="true">{describe(tab.href).icon}</span><span>{describe(tab.href).label}</span></a>
              <button type="button" className="workspace-tab-close" disabled={tabs.length === 1} aria-label={`Close ${describe(tab.href).label} tab`} onClick={() => closeTab(tab.id)}><X aria-hidden="true" /></button>
            </ChromeTab>)}
          </Reorder.Group>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="workspace-tab-action" aria-label="Open a new tab"><Plus aria-hidden="true" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="workspace-tab-menu">
            <DropdownMenuLabel className="workspace-tab-menu-label">Open in a new tab</DropdownMenuLabel>
            {navItems.map(item => <DropdownMenuItem key={item.to} disabled={tabs.length >= 24} onSelect={() => addTab(item.to)}>{item.icon}<span>{item.tabLabel ?? item.label}</span></DropdownMenuItem>)}
            {tabs.length >= 24 && <p className="workspace-tab-hint">Close a tab before opening another. You can keep 24 tabs open.</p>}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><button type="button" className="workspace-tab-action" aria-label="Tab actions"><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="workspace-tab-menu">
            <DropdownMenuLabel className="workspace-tab-menu-label">Current tab</DropdownMenuLabel>
            <DropdownMenuItem disabled={activeIndex <= 0} onSelect={() => moveTab(activeId, -1)}><ArrowLeft aria-hidden="true" />Move tab left</DropdownMenuItem>
            <DropdownMenuItem disabled={activeIndex >= tabs.length - 1} onSelect={() => moveTab(activeId, 1)}><ArrowRight aria-hidden="true" />Move tab right</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={tabs.length <= 1} onSelect={() => closeTab(activeId)}><X aria-hidden="true" />Close tab</DropdownMenuItem>
            <DropdownMenuItem disabled={tabs.length <= 1} onSelect={() => keepTabs(tabs.filter(tab => tab.id === activeId))}>Close other tabs</DropdownMenuItem>
            <DropdownMenuItem disabled={activeIndex <= 0} onSelect={() => keepTabs(tabs.slice(activeIndex))}>Close tabs to the left</DropdownMenuItem>
            <DropdownMenuItem disabled={activeIndex >= tabs.length - 1} onSelect={() => keepTabs(tabs.slice(0, activeIndex + 1))}>Close tabs to the right</DropdownMenuItem>
            <p className="workspace-tab-hint">Drag a tab to reorder, or focus a tab and press Alt + an arrow key.</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <header className="admin-topbar"><div className="topbar-context"><span>GoodNews Halobox</span><strong>{describe(href).label}</strong></div>{account}</header>
      {navigating && <div className="admin-route-progress" role="status"><span className="sr-only">Loading page…</span></div>}
      {navigationError && <p className="workspace-tab-error" role="alert">{navigationError}</p>}
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      <span className="sr-only" id="workspace-tab-instructions">Use arrow keys to focus tabs, Enter to open, Delete to close, and Alt with left or right arrow to reorder.</span>
      <main className="admin-main" id="main-content" tabIndex={-1} aria-busy={navigating}>
        <div className="workspace-tab-panel" id="workspace-tab-panel" role="tabpanel" aria-labelledby={`workspace-tab-${activeId}`}>{children}</div>
      </main>
    </div>
  </div>
}

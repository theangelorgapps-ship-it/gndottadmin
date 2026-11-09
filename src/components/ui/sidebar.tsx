"use client"

import { AdminBrand } from "../AdminBrand"
import { cn } from "@/lib/utils"
import { Link, useRouterState } from "@tanstack/react-router"
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react"

interface Links {
  label: string
  href: string
  icon: React.ReactNode
}

interface SidebarContextProps {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  animate: boolean
  mobileOpen: boolean
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = false,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) => {
  const [openState, setOpenState] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const open = openProp !== undefined ? openProp : openState
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState

  return (
    <SidebarContext.Provider
      value={{ open, setOpen, animate, mobileOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) => (
  <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
    {children}
  </SidebarProvider>
)

export const SidebarBody = (props: React.ComponentProps<"div">) => (
  <>
    <DesktopSidebar {...props} />
    <MobileSidebar {...props} />
  </>
)

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar()
  return (
    <aside
      className={cn("sidebar-desktop", className)}
      data-expanded={open ? "true" : "false"}
      aria-label="Admin navigation"
      {...props}
    >
      <div className="sidebar-desktop-content" id="admin-sidebar-content">
        {children}
      </div>
      <button
        type="button"
        className="sidebar-collapse"
        aria-controls="admin-sidebar-content"
        aria-expanded={open}
        aria-label={open ? "Collapse navigation" : "Expand navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <PanelLeftClose aria-hidden="true" /> : <PanelLeftOpen aria-hidden="true" />}
        <span className="sidebar-collapse-label">
          {open ? "Collapse navigation" : "Expand navigation"}
        </span>
      </button>
    </aside>
  )
}

export const MobileSidebar = ({
  className,
  children,
  onClickCapture,
  ...props
}: React.ComponentProps<"div">) => {
  const { mobileOpen, setMobileOpen } = useSidebar()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (mobileOpen && !dialog.open) dialog.showModal()
    if (!mobileOpen && dialog.open) dialog.close()
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)")
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [setMobileOpen])

  const close = () => setMobileOpen(false)

  return (
    <div className="sidebar-mobile">
      <div className="sidebar-mobile-bar">
        <AdminBrand />
        <button
          ref={menuButtonRef}
          type="button"
          className="sidebar-menu-button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-haspopup="dialog"
          aria-controls="admin-mobile-navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu aria-hidden="true" />
        </button>
      </div>
      <dialog
        ref={dialogRef}
        id="admin-mobile-navigation"
        className="sidebar-dialog"
        aria-labelledby="admin-mobile-navigation-title"
        onCancel={(event) => {
          // Native dialog cancellation is the Escape-key interaction.
          event.preventDefault()
          close()
        }}
        onClose={() => menuButtonRef.current?.focus()}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div
          className={cn("sidebar-dialog-panel", className)}
          {...props}
          onClickCapture={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) close()
            onClickCapture?.(event)
          }}
        >
          <div className="sidebar-dialog-header">
            <h2 id="admin-mobile-navigation-title">Admin navigation</h2>
            <button
              type="button"
              className="sidebar-close-button"
              aria-label="Close navigation"
              onClick={close}
              autoFocus
            >
              <X aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </div>
  )
}

export const SidebarLink = ({
  link,
  className,
  active = false,
  onClick,
  ...props
}: {
  link: Links
  className?: string
  active?: boolean
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  [key: string]: any
}) => {
  const { setMobileOpen } = useSidebar()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const current = pathname === link.href

  return (
    <Link
      to={link.href as any}
      className={cn("sidebar-link", className)}
      aria-label={link.label}
      aria-current={current ? "page" : undefined}
      data-active={active || current ? "true" : undefined}
      data-current={current ? "true" : undefined}
      onClick={(event) => {
        setMobileOpen(false)
        onClick?.(event)
      }}
      {...props}
    >
      <span className="sidebar-link-icon" aria-hidden="true">{link.icon}</span>
      <span className="sidebar-label">{link.label}</span>
    </Link>
  )
}

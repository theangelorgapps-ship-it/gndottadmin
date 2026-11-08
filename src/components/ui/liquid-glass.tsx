"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface GlassEffectProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  href?: string
  target?: string
}

interface DockIcon {
  src: string
  alt: string
  onClick?: () => void
}

const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style,
  href,
  target = "_blank",
}) => {
  const content = (
    <div className={cn("liquid-glass", className)} style={style}>
      {children}
    </div>
  )

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="liquid-glass-link">
      {content}
    </a>
  ) : content
}

const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({ icons, href }) => (
  <GlassEffect className="liquid-glass-dock">
    <div className="liquid-glass-dock-items">
      {icons.map((icon) => {
        const image = <img src={icon.src} alt={icon.alt} />
        return icon.onClick ? (
          <button key={`${icon.src}-${icon.alt}`} type="button" onClick={icon.onClick} aria-label={icon.alt}>
            {image}
          </button>
        ) : href ? (
          <a key={`${icon.src}-${icon.alt}`} href={href} target="_blank" rel="noopener noreferrer">
            {image}
          </a>
        ) : <img key={`${icon.src}-${icon.alt}`} src={icon.src} alt={icon.alt} />
      })}
    </div>
  </GlassEffect>
)

const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({ children, href }) => (
  <GlassEffect href={href} className="liquid-glass-button">
    {children}
  </GlassEffect>
)

// Kept as a compatibility export for existing auth callers. The shared glass
// treatment uses CSS rather than an animated SVG displacement filter.
const GlassFilter: React.FC = () => null

export { GlassEffect, GlassDock, GlassButton, GlassFilter }
export type { GlassEffectProps, DockIcon }

export const Component = () => (
  <GlassEffect className="liquid-glass-button">GoodNews Halobox</GlassEffect>
)

export default Component

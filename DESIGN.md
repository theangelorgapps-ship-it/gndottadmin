---
name: GoodNews Halobox Admin
description: A calm, responsive operations workspace for Christian streaming content.
colors:
  primary: "#60a5fa"
  primary-strong: "#3b82f6"
  canvas: "#07111f"
  surface: "#0d1929"
  surface-raised: "#122238"
  border: "#24364d"
  text: "#f3f7fc"
  muted: "#9aabc0"
  success: "#34d399"
  warning: "#fbbf24"
  danger: "#fb7185"
typography:
  headline:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

## Overview

GoodNews Halobox Admin is a task-focused workspace. Deep navy separates the navigation and page canvas; raised surfaces identify working areas without turning every panel into a decorative card. Blue is reserved for primary actions, active navigation, links, and focus. Layouts use a fixed desktop rail, a mobile drawer, fluid content widths, and local overflow for dense data. Motion is brief and optional.

## Colors

Use `canvas` for the page and input wells, `surface` for panels, and `surface-raised` for hovered or elevated controls. Body text uses `text`; supporting text uses `muted` while retaining readable contrast. Borders are visible but quiet. Success, warning, and danger communicate state only. Do not reintroduce legacy red as the brand accent.

## Typography

Use Inter or Geist with a system sans fallback. Operational text is 14 px by default, labels are 12–13 px, and page headings stay within 22–28 px. Use weight and spacing for hierarchy rather than oversized type. Numeric data may use tabular numerals. Long values wrap or ellipsize within their own container.

## Elevation

Most surfaces are flat with a 1 px border. Use `0 12px 36px rgba(0,0,0,.28)` only for dialogs, menus, and the mobile drawer. Navigation and sign-in may use a restrained translucent background with backdrop blur. Focus uses a 2 px blue outline with offset, not a large glow.

## Components

### Buttons

Primary buttons use blue, secondary buttons use a raised navy surface, and destructive actions use the danger token. Controls are at least 40 px tall on desktop and 44 px on touch layouts. Busy controls retain their width and expose disabled state.

### Chips

Status chips are compact, rounded, and limited to meaningful state. Use text plus color; never use rating stars or decorative badge collections.

### Cards and data

Panels use a 14 px radius, 1 px border, and 16–24 px padding. Tables remain inside labeled local scroll containers, with sticky row actions where needed. Pagination and search stay outside the horizontal scroller.

### Inputs and forms

Inputs use a dark well, visible border, and explicit label. Focus changes the border and adds the standard outline. Forms move from two columns to one on narrow screens. Dependent selectors remain disabled with an explanatory placeholder until their parent is chosen.

### Navigation and dialogs

Desktop navigation is a stable rail with clear active and hover states. On mobile it becomes a modal drawer with a named close button, backdrop, Escape handling, and focus return. Dialogs have a title, contained scrolling, keyboard-safe actions, and no page-level overflow.

## Do's and Don'ts

### Do:

- Do use GoodNews Halobox, Sermons, Shows, Teachings, Videos, Personalities, and Locations in visible copy.
- Do preserve existing URLs, field names, uploads, settings, and CRUD behavior.
- Do test every route at desktop and 390 px and keep overflow inside data components.
- Do provide visible focus, dialog names, toggle state, reduced motion, and useful empty/error feedback.

### Don't:

- Don't use Streamit, legacy red branding, IMDb references, ratings, stars, or review-oriented UI.
- Don't use oversized headings, decorative gradients, glassmorphism on working panels, or excessive pills.
- Don't clip dropdowns, hide essential mobile actions, or allow horizontal page overflow.
- Don't replace live-only features with the older repository implementation.

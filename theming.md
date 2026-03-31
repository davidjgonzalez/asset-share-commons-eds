---
layout: page
title: Theming
permalink: /theming
sidebar:
  - label: Theming
    items:
      - title: Overview
        url: "#overview"
      - title: Built-in Themes
        url: "#built-in-themes"
      - title: Switching Themes
        url: "#switching"
      - title: Creating a Theme
        url: "#creating"
  - label: CSS Variables
    items:
      - title: Colors
        url: "#colors"
      - title: Typography
        url: "#typography"
      - title: Spacing & Shape
        url: "#spacing"
      - title: Component Variables
        url: "#components"
---

# Theming

Asset Share Commons uses a CSS variable-based theming system. A theme is a CSS file that overrides variables — no JavaScript, no build step.

## Overview {#overview}

The default theme is defined in `styles/default.css` as CSS custom properties on `:root`. Every theme in `styles/themes/` overrides a subset of these variables.

```
styles/
  default.css          ← base variable definitions
  themes/
    dark.css           ← dark theme overrides
    warm.css           ← warm neutral theme
    studio.css         ← creative studio theme
    vault.css          ← archival/muted theme
    high-contrast.css  ← accessibility theme
```

![Theme switcher preview](https://placehold.co/860x400/111111/e91e8c?text=Theme+Switcher+Preview&font=inter)

*Five built-in themes — default, dark, warm, studio, vault*

## Built-in Themes {#built-in-themes}

| Theme | Description |
|-------|-------------|
| `default` | Clean light theme — white background, blue accents |
| `dark` | Dark background with high-contrast text |
| `warm` | Off-white background with warm amber accents |
| `studio` | Creative dark theme with purple/magenta accents |
| `vault` | Archival grey with muted tones |
| `high-contrast` | Maximally accessible — WCAG AAA contrast |

## Switching Themes {#switching}

Set the active theme in `scripts/configurations.js`:

```js
theme: {
  default: 'dark',   // 'default' | 'dark' | 'warm' | 'studio' | 'vault'
}
```

Edge Delivery Services sets `data-theme="{name}"` on the `<body>` element, and the matching theme CSS is loaded from `styles/themes/{name}.css`.

You can also switch themes at runtime:

```js
import { setTheme } from '/scripts/asc/utils/theme.js';
setTheme('warm');
```

## Creating a Theme {#creating}

1. Copy `styles/themes/dark.css` to `styles/themes/my-theme.css`
2. Override the variables you want to change
3. Set `theme.default: 'my-theme'` in `configurations.js`

```css
/* styles/themes/my-theme.css */
[data-theme="my-theme"] {
  --color-background:    #faf5f0;
  --color-surface:       #fff;
  --color-accent:        #d4380d;
  --color-accent-hover:  #b82d0b;
  --color-text:          #1a1a1a;
  --color-text-muted:    #555;
}
```

Only override what you need — unset variables fall back to `default.css`.

---

## CSS Variable Reference

### Colors {#colors}

| Variable | Default | Description |
|----------|---------|-------------|
| `--color-background` | `#ffffff` | Page background |
| `--color-surface` | `#f8f9fa` | Card/panel background |
| `--color-surface-raised` | `#ffffff` | Elevated surface (modal, dropdown) |
| `--color-border` | `#e2e4e8` | Default border color |
| `--color-accent` | `#0066cc` | Primary brand color |
| `--color-accent-hover` | `#0052a3` | Hover state for accent |
| `--color-accent-subtle` | `#e8f2ff` | Tinted accent background |
| `--color-text` | `#1a1a2e` | Primary text |
| `--color-text-muted` | `#6b7280` | Secondary/muted text |
| `--color-text-inverse` | `#ffffff` | Text on dark/accent backgrounds |
| `--color-success` | `#16a34a` | Success state |
| `--color-warning` | `#d97706` | Warning state |
| `--color-error` | `#dc2626` | Error state |

### Typography {#typography}

| Variable | Default | Description |
|----------|---------|-------------|
| `--font-sans` | `system-ui, sans-serif` | Body font stack |
| `--font-mono` | `'JetBrains Mono', monospace` | Code font stack |
| `--font-size-base` | `16px` | Base font size (rem root) |
| `--font-size-sm` | `0.875rem` | Small text |
| `--font-size-lg` | `1.125rem` | Large body text |
| `--line-height-body` | `1.6` | Paragraph line height |
| `--line-height-heading` | `1.2` | Heading line height |
| `--font-weight-normal` | `400` | Regular weight |
| `--font-weight-medium` | `500` | Medium weight |
| `--font-weight-bold` | `700` | Bold weight |

### Spacing & Shape {#spacing}

| Variable | Default | Description |
|----------|---------|-------------|
| `--space-1` | `4px` | Extra-small spacing |
| `--space-2` | `8px` | Small spacing |
| `--space-3` | `12px` | — |
| `--space-4` | `16px` | Medium spacing |
| `--space-6` | `24px` | Large spacing |
| `--space-8` | `32px` | Extra-large spacing |
| `--space-12` | `48px` | — |
| `--space-16` | `64px` | Section spacing |
| `--radius-sm` | `4px` | Small corner radius |
| `--radius` | `8px` | Default corner radius |
| `--radius-lg` | `12px` | Large corner radius |
| `--radius-full` | `9999px` | Pill/circle |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.1)` | Subtle shadow |
| `--shadow` | `0 4px 12px rgba(0,0,0,.1)` | Default shadow |
| `--shadow-lg` | `0 16px 48px rgba(0,0,0,.15)` | Large shadow |

### Component Variables {#components}

| Variable | Description |
|----------|-------------|
| `--nav-height` | Height of the sticky navigation bar |
| `--nav-bg` | Navigation background |
| `--nav-text` | Navigation link color |
| `--sidebar-width` | Documentation sidebar width |
| `--asset-teaser-aspect` | Aspect ratio for asset grid thumbnails |
| `--modal-backdrop` | Modal overlay background color |
| `--transition-fast` | Fast animation duration (`100ms ease`) |
| `--transition` | Default animation duration (`200ms ease`) |
| `--transition-slow` | Slow animation duration (`400ms ease`) |

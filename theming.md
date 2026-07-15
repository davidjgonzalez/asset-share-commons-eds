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
  - label: CSS Tokens
    items:
      - title: Colors
        url: "#colors"
      - title: Structural Tokens
        url: "#typography"
      - title: Component Variables
        url: "#components"
---

# Theming

Asset Share Commons uses a semantic CSS custom property (variable) system for theming. A theme is a CSS file that overrides `--color-*` variables — no JavaScript, no build step.

## Overview {#overview}

Themes override a set of **semantic `--color-*` tokens** on a `.theme-{name}` class applied to `<body>`. Structural tokens (spacing, radius, shadow, typography scale) live in `styles/tokens.css` and are shared across every theme, so a theme file only ever needs to set color roles (and optionally the font family).

```
styles/
  styles.css        ← .btn, .asc-panel, .asc-dialog, and the semantic token :root defaults
  tokens.css         ← structural tokens (spacing, radius, shadow, typography scale)
  themes/
    default.css      ← Violet Studio — light, violet accents
    dark.css         ← Deep Ocean — dark navy surfaces, azure accents
    studio.css       ← Unsplash — near-black, image-first, pill buttons
    pro.css          ← extra theme file, not wired into configurations.js by default
    custom.css       ← starting point for your own theme
```

![Theme switcher preview](https://placehold.co/860x400/111111/e91e8c?text=Theme+Switcher+Preview&font=inter)

*Built-in themes — default, dark, studio*

## Built-in Themes {#built-in-themes}

| Theme | Description |
|-------|-------------|
| `default` | Violet Studio — clean light theme, violet primary |
| `dark` | Deep Ocean — dark navy surfaces, azure blue accents |
| `studio` | Unsplash — near-black, image-first, pill-shaped buttons |

## Switching Themes {#switching}

Set the active theme in `scripts/asc/configurations.js`:

```js
theme: {
  default: 'dark',   // 'default' | 'dark' | 'studio'
}
```

The `ascEager(doc)` hook in `scripts/asc.js` reads this value on page load, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`.

## Creating a Theme {#creating}

Themes override **only** `--color-*` semantic tokens (and optionally `--body-font-family`). **Never** override structural tokens like spacing, border-radius, or shadow in a theme file — those live in `styles/tokens.css` and are shared across all themes.

1. Copy `styles/themes/dark.css` to `styles/themes/my-theme.css`
2. Override the color roles you want to change
3. Set `theme.default: 'my-theme'` in `configurations.js`

```css
/* styles/themes/my-theme.css */
.theme-my-theme {
  /* ── Required color roles ─────────────────────────────────────────── */
  --color-bg:             #f5f5f0;
  --color-fg:             #1a1a1a;
  --color-card:           #ffffff;
  --color-card-fg:        #1a1a1a;
  --color-primary:        #c44b0a;   /* Action color */
  --color-primary-fg:     #ffffff;   /* Text ON primary */
  --color-secondary:      #eeece8;
  --color-secondary-fg:   #1a1a1a;
  --color-muted:          #f0ede8;   /* Subtle backgrounds */
  --color-muted-fg:       #6b6560;   /* Secondary text */
  --color-accent:         #fce8dd;   /* Hover tints */
  --color-accent-fg:      #c44b0a;
  --color-destructive:    #dc2626;
  --color-destructive-fg: #ffffff;
  --color-border:         #ddd8d0;
  --color-input:          #ffffff;
  --color-ring:           #c44b0a;   /* Focus outline */

  /* ── Optional overrides ──────────────────────────────────────────── */
  --body-font-family: Georgia, serif;

  /* For dark themes, override the select chevron to a light color: */
  /* --select-arrow: url("data:image/svg+xml,..."); */
}
```

Only override what you need — unset tokens fall back to the base defaults in `styles.css`.

---

## CSS Token Reference

### Colors {#colors}

Every component reads from these semantic roles — changing a token updates every block that uses it.

| Token | Role |
|-------|------|
| `--color-bg` | Page background |
| `--color-fg` | Default text |
| `--color-card` / `--color-card-fg` | Card surface / text |
| `--color-popover` / `--color-popover-fg` | Dropdown/tooltip surface / text |
| `--color-primary` / `--color-primary-fg` | Primary action (buttons, links, badges) / text on primary |
| `--color-secondary` / `--color-secondary-fg` | Secondary surface / text |
| `--color-muted` / `--color-muted-fg` | Subtle background / secondary text |
| `--color-accent` / `--color-accent-fg` | Hover tint backgrounds / text |
| `--color-destructive` / `--color-destructive-fg` | Danger/delete actions / text |
| `--color-border` | All borders and dividers |
| `--color-input` | Form input backgrounds |
| `--color-ring` | Focus outline color |

### Structural Tokens (do not override in themes) {#typography}

These live in `styles/tokens.css` and are shared across all themes:

| Group | Variables |
|-------|-----------|
| Spacing | `--spacing-xs` / `sm` / `md` / `lg` / `xl` |
| Border radius | `--border-radius-sm` / `md` / `lg` / `xl` / `full` |
| Shadows | `--shadow-sm` / `md` / `lg` |
| Transitions | `--transition-fast` / `normal` / `slow` |
| Typography scale | `--body-font-size-xs` / `s` / `m` / `l` · `--heading-font-size-s` / `m` / `l` / `xl` |
| Button structural | `--button-padding` · `--button-border-radius` |
| Input structural | `--input-border-radius` · `--input-focus-ring-width` |

> **Removed / renamed** — older variable names like `--color-background`, `--text-color`, `--font-size-sm`, and `--radius-md` no longer exist. Use the semantic `--color-*` tokens above and the structural tokens from `styles/tokens.css` instead.

### Component Variables {#components}

| Variable | Description |
|----------|-------------|
| `--sidebar-width` / `--aside-sidebar-width` | Aside section sidebar width — see [Section Layouts](/layouts#aside) |
| `--grid-gap` / `--aside-gap` | Section grid/aside gap override |
| `--button-border-radius` | Override for pill-shaped buttons — see the theme-scoped example below |

## Button Utilities

Themes inherit global `.btn` utility classes defined in `styles/styles.css`. No per-theme button CSS needed unless you want shape overrides:

```css
/* Example: pill buttons for a theme, like styles/themes/studio.css */
.theme-my-theme {
  --button-border-radius: var(--border-radius-full);
}
```

## Theme-Scoped Block Overrides

For visual changes beyond variables, scope overrides to your theme class:

```css
.theme-my-theme .asc-asset-teaser:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

See `styles/themes/studio.css` for a real example with image hover zoom.

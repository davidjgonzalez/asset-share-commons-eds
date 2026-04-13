# Theming

Asset Share Commons uses a semantic CSS custom property (variable) system for theming. A theme is a CSS file that overrides `--color-*` variables — no JavaScript involved.

## Activating a Theme

Set `theme.default` in `scripts/configurations.js`:

```js
theme: {
  default: 'studio',  // built-in: default | dark | studio
}
```

`scripts/scripts.js` reads this on page load, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`.

## Built-in Themes

| Name | Description |
|------|-------------|
| `default` | Violet Studio — clean light theme, violet primary |
| `dark` | Deep Ocean — dark navy surfaces, azure blue accents |
| `studio` | Unsplash — near-black, image-first, pill buttons |

## Creating a Custom Theme

Themes only need to override `--color-*` semantic tokens. Structural tokens (spacing, radius, shadow) are defined in `styles/tokens.css` and do not need to be set per theme.

1. Create `styles/themes/my-theme.css`:

```css
.theme-my-theme {
  /* ── Required color roles ─────────────────────────────────── */
  --color-bg:             #f5f5f0;   /* Page background */
  --color-fg:             #1a1a1a;   /* Default text */
  --color-card:           #ffffff;   /* Card surfaces */
  --color-card-fg:        #1a1a1a;
  --color-primary:        #c44b0a;   /* Buttons, links, accents */
  --color-primary-fg:     #ffffff;   /* Text ON primary color */
  --color-secondary:      #eeece8;
  --color-secondary-fg:   #1a1a1a;
  --color-muted:          #f0ede8;   /* Subtle backgrounds */
  --color-muted-fg:       #6b6560;   /* Secondary / placeholder text */
  --color-accent:         #fce8dd;   /* Hover tints */
  --color-accent-fg:      #c44b0a;
  --color-destructive:    #dc2626;   /* Delete / danger actions */
  --color-destructive-fg: #ffffff;
  --color-border:         #ddd8d0;   /* All borders and dividers */
  --color-input:          #ffffff;   /* Form input backgrounds */
  --color-ring:           #c44b0a;   /* Focus outline */

  /* ── Optional ──────────────────────────────────────────────── */
  --body-font-family: Georgia, serif;

  /* Dark themes should override the select chevron:
  --select-arrow: url("data:image/svg+xml,..."); */
}
```

2. Activate it:
```js
// scripts/configurations.js
theme: { default: 'my-theme' }
```

## Semantic Color Token Reference

Themes override **only** `--color-*` tokens. Every component reads from these roles — changing a token updates every block that uses it.

| Token | Role |
|-------|------|
| `--color-bg` | Page background |
| `--color-fg` | Default text color |
| `--color-card` / `--color-card-fg` | Card surface / text on card |
| `--color-popover` / `--color-popover-fg` | Dropdown and tooltip surfaces |
| `--color-primary` / `--color-primary-fg` | Primary action color (buttons, links, badges) / text on primary |
| `--color-secondary` / `--color-secondary-fg` | Secondary surface |
| `--color-muted` / `--color-muted-fg` | Subtle backgrounds / secondary text |
| `--color-accent` / `--color-accent-fg` | Hover tint backgrounds |
| `--color-destructive` / `--color-destructive-fg` | Danger / delete actions |
| `--color-border` | All borders and dividers |
| `--color-input` | Form input backgrounds |
| `--color-ring` | Focus outline (`:focus-visible`) |

## Structural Tokens (do not override in themes)

These live in `styles/tokens.css` and are shared across all themes:

| Group | Variables |
|-------|-----------|
| Spacing | `--spacing-xs/sm/md/lg/xl` |
| Border radius | `--border-radius-sm/md/lg/xl/full` |
| Shadows | `--shadow-sm/md/lg` |
| Transitions | `--transition-fast/normal/slow` |
| Typography scale | `--body-font-size-xs/s/m/l` · `--heading-font-size-s/m/l/xl` |
| Button structural | `--button-padding` · `--button-border-radius` |
| Input structural | `--input-border-radius` · `--input-focus-ring-width` |

## Button Utilities

Themes inherit global `.btn` utility classes defined in `styles/styles.css`. No per-theme button CSS needed unless you want shape overrides:

```css
/* Example: pill buttons for the studio theme */
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

See `styles/themes/studio.css` for an example with image hover zoom.

# Theming

Asset Share Commons uses a CSS custom property (variable) system for theming. A theme is a CSS file that overrides variables — no JavaScript involved.

## Activating a Theme

Set `theme.default` in `scripts/configurations.js`:

```js
theme: {
  default: 'vault',  // built-in: default | dark | warm | studio | vault
}
```

`scripts/scripts.js` reads this on page load, adds `theme-{name}` to `<body>`, and loads `styles/themes/{name}.css`.

## Built-in Themes

| Name | Description |
|------|-------------|
| `default` | Clean neutral light theme — EDS boilerplate defaults |
| `dark` | Dark mode with blue accents |
| `warm` | Warm earthy tones, orange accents |
| `studio` | Webflow-inspired SaaS aesthetic — blue + violet, pill buttons, card hover lift |
| `vault` | Dark professional DAM UI — near-black surfaces, blue accent, ghost buttons |

## Creating a Custom Theme

1. Copy `styles/themes/custom.css` as a starting point, or create a new file:

```css
/* styles/themes/my-theme.css */
.theme-my-theme {

  /* ── Base ─── */
  --background-color: #f5f5f0;
  --light-color: #ebe9e2;
  --dark-color: #6b6560;
  --text-color: #1a1a1a;
  --link-color: #c44b0a;
  --link-hover-color: #a33c07;
  --border-color: #dddad4;

  /* ── Asset teaser card ─── */
  --asset-teaser-bg: #ffffff;
  --asset-teaser-border: 1px solid #dddad4;
  --asset-teaser-border-radius: var(--border-radius-md);

  /* ── Search ─── */
  --search-primary-color: #c44b0a;
  --search-input-focus-border: #c44b0a;

  /* ── Buttons ─── */
  --button-primary-bg: #c44b0a;
  --button-primary-text: #ffffff;
  --button-primary-hover-bg: #a33c07;

  /* Override any variable from styles/tokens.css */
}
```

2. Activate it:
```js
// scripts/configurations.js
theme: { default: 'my-theme' }
```

## CSS Variable Reference

All theme-overridable variables are defined in `styles/tokens.css`. Key groups:

| Group | Variables |
|-------|-----------|
| Base | `--background-color` `--light-color` `--dark-color` `--text-color` `--link-color` `--link-hover-color` `--border-color` |
| Typography | `--body-font-family` `--heading-font-family` |
| Spacing | `--spacing-xs` `--spacing-sm` `--spacing-md` `--spacing-lg` `--spacing-xl` |
| Border radius | `--border-radius-sm` `--border-radius-md` `--border-radius-lg` `--border-radius-xl` `--border-radius-full` |
| Shadows | `--shadow-sm` `--shadow-md` `--shadow-lg` |
| Transitions | `--transition-fast` `--transition-normal` `--transition-slow` |
| Asset teaser | `--asset-teaser-bg` `--asset-teaser-border` `--asset-teaser-border-radius` `--asset-teaser-shadow` `--asset-teaser-shadow-hover` `--asset-teaser-title-color` `--asset-teaser-meta-color` |
| Search | `--search-background` `--search-text-color` `--search-primary-color` `--search-input-bg` `--search-input-color` `--search-input-focus-border` `--search-input-focus-ring` |
| Search results | `--search-results-gap` `--search-results-cols-mobile` `--search-results-cols-tablet` `--search-results-cols-desktop` |
| Filters | `--filter-label-color` `--filter-input-border` `--filter-input-accent` |
| Modal | `--modal-bg` `--modal-border-radius` `--modal-shadow` `--modal-backdrop` `--modal-padding` |
| Buttons | `--button-primary-bg` `--button-primary-text` `--button-primary-hover-bg` `--button-primary-border-radius` `--button-padding` `--button-secondary-bg` `--button-secondary-border` `--button-secondary-text` |
| Inputs | `--input-background` `--input-text-color` `--input-border-color` `--input-border-focus` `--input-border-radius` `--input-placeholder-color` `--input-focus-ring-color` `--input-transition` |

## Theme-Scoped Overrides

Themes can also override block-level styles directly, not just variables:

```css
.theme-my-theme .asc-asset-teaser:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.theme-my-theme .block.search-bar input {
  border-radius: var(--border-radius-full);
}
```

See `styles/themes/studio.css` and `styles/themes/vault.css` for examples of per-block theme overrides.

# CSS Convention Guide

## Block Root Selector

Every block's CSS file must scope all styles under `.block.<block-name>`:

```css
.block.search-bar {
  /* all styles for this block go here */
}
```

Never write bare classes at the top level. EDS appends both `block` and the block name as classes.

## CSS Nesting

Use native CSS nesting for child elements, modifiers, and states:

```css
.block.search-bar {
  width: 100%;

  input {
    padding: var(--spacing-md);

    &::placeholder {
      color: var(--search-input-placeholder-color);
    }

    &:focus {
      border-color: var(--search-input-focus-border);
      box-shadow: var(--search-input-focus-ring);
      outline: none;
    }
  }

  /* block modifier — .block.search-bar.large */
  &.large input {
    font-size: var(--body-font-size-m);
    padding: var(--spacing-lg);
  }
}
```

## CSS Variables

Use variables for everything that a theme might override. All variables are defined in `styles/tokens.css`. Never hard-code colors, spacing, radius, shadows, or transitions.

```css
/* ✅ correct */
background: var(--asset-teaser-bg);
padding: var(--spacing-md);
border-radius: var(--border-radius-md);
transition: background var(--transition-fast);

/* ❌ avoid */
background: #ffffff;
padding: 16px;
border-radius: 8px;
transition: background 120ms ease;
```

See `styles/tokens.css` for the complete variable list. See `THEMING_README.md` for grouped reference.

## Responsive Design

Mobile-first. Use the `width >=` syntax:

```css
.block.search-results [data-asc-results] {
  /* mobile: single column */
  grid-template-columns: repeat(var(--search-results-cols-mobile, 1), 1fr);

  @media (width >= 768px) {
    grid-template-columns: repeat(var(--search-results-cols-tablet, 3), 1fr);
  }

  @media (width >= 1024px) {
    grid-template-columns: repeat(var(--search-results-cols-desktop, 5), 1fr);
  }
}
```

Breakpoints: `768px` (tablet), `1024px` (desktop).

## Parts CSS

Parts (reusable UI components) scope to `.asc-{part-name}`, not `.block.*`:

```css
/* blocks/search-results/search-results.css — the block container */
.block.search-results { ... }

/* scripts/asc/parts/asset-teaser/asset-teaser.css — the part */
.asc-asset-teaser { ... }
.asc-asset-teaser--list { ... }   /* mode modifier */
.asc-asset-teaser__title { ... }  /* BEM child element */
```

Parts load their own CSS via `loadCSS()` at module import time. Do not import part CSS from block CSS files.

## Accessibility

Include at minimum:

```css
/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .block.my-block * {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}

/* Visible focus for keyboard navigation */
.block.my-block button:focus-visible,
.block.my-block a:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
}
```

## File Organization

- Block CSS: `blocks/<block-name>/<block-name>.css`
- Part CSS: `scripts/asc/parts/<part-name>/<part-name>.css`
- Theme overrides: `styles/themes/<theme-name>.css`
- Shared tokens: `styles/tokens.css`
- Global base: `styles/styles.css` (imports `tokens.css`)

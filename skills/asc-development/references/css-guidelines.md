# CSS Guidelines for ASC

ASC CSS conventions, token reference, and theme creation guide.

---

## Quick Reference

### Root Selector

Use `main .block-name` (future state) or `.block.block-name` (current state):

```css
main .my-block { }  /* Future state (Phase 7) */
.block.my-block { } /* Current state */
```

### Nesting

Always use CSS nesting for child elements:

```css
main .my-block {
  display: grid;
  
  & h2 { /* child heading */ }
  
  & .my-block__item { /* BEM-style child */ }
  
  & button { /* descendant */ }
  
  & &.dark { /* variant modifier */ }
}
```

### Color Tokens

Use semantic color tokens, never hardcoded colors:

```css
/* ✅ RIGHT */
background: var(--color-card);
color: var(--color-fg);
border-color: var(--color-border);

/* ❌ WRONG */
background: #ffffff;
color: #1a1a1a;
border-color: #e0e0e0;
```

### Spacing, Radius, Shadow

Use structural tokens for all spacing, borders, and shadows:

```css
/* Spacing: xs, sm, md, lg, xl */
padding: var(--spacing-md);
margin: var(--spacing-lg);
gap: var(--spacing-sm);

/* Border radius: s, m, l, full */
border-radius: var(--border-radius-m);

/* Shadow: xs, sm, md, lg */
box-shadow: var(--shadow-md);

/* Transitions: fast, normal, slow */
transition: all var(--transition-normal);
```

### Units: rem vs px

**Use `rem` by default. Use `px` only for physical pixel measurements.**

| Use `rem` for | Use `px` for |
|---------------|-------------|
| Font sizes | Hairline borders (`1px`, `2px`) |
| Spacing (padding, margin, gap) | Shadow offsets and blur |
| Component widths/heights | Precise visual effects |
| Border radius | Icon dimensions (when exact pixel matters) |
| Layout measurements | |

```css
/* ✅ rem — scales with user preferences */
padding: 1rem;
border-radius: 0.5rem;
min-height: 2.5rem;

/* ✅ px — physical measurement */
border: 1px solid var(--color-border);
box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
```

### Typography

Use semantic font size and weight tokens:

```css
/* Headings: s, m, l, xl */
h2 { font-size: var(--heading-font-size-m); }

/* Body: xs, s (default), m, l */
.text-small { font-size: var(--body-font-size-xs); }

/* Font family */
font-family: var(--body-font-family);
```

---

## Semantic Color Tokens

ASC defines 16 semantic color variables in `styles/tokens.css` `:root`:

### Primary & Secondary

| Token | Purpose |
|-------|---------|
| `--color-primary` | Primary action color (buttons, links, highlights) |
| `--color-primary-fg` | Text color ON primary backgrounds |
| `--color-secondary` | Secondary surface (less prominent) |
| `--color-secondary-fg` | Text ON secondary surface |

### Backgrounds

| Token | Purpose |
|-------|---------|
| `--color-bg` | Page background |
| `--color-fg` | Default body text |
| `--color-card` | Card/container background |
| `--color-card-fg` | Text on card backgrounds |

### Semantic States

| Token | Purpose |
|-------|---------|
| `--color-muted` | Subtle background (disabled, secondary text) |
| `--color-muted-fg` | Text on muted backgrounds |
| `--color-accent` | Hover tints, highlights |
| `--color-accent-fg` | Text on accent backgrounds |
| `--color-destructive` | Danger/delete actions (red) |
| `--color-destructive-fg` | Text on destructive backgrounds |

### Structural

| Token | Purpose |
|-------|---------|
| `--color-border` | All borders and dividers |
| `--color-input` | Form input background |
| `--color-ring` | Focus outline (keyboard navigation) |

---

## Complete Token Reference

### All Semantic Colors (16 tokens)

```css
/* Copy into a new theme CSS file */
:root {
  /* Primary & secondary */
  --color-primary:        #7c3aed;    /* Main action color */
  --color-primary-fg:     #ffffff;    /* Text on primary */
  --color-secondary:      #f3f4f6;
  --color-secondary-fg:   #1f2937;

  /* Backgrounds */
  --color-bg:             #ffffff;    /* Page background */
  --color-fg:             #1f2937;    /* Body text */
  --color-card:           #ffffff;
  --color-card-fg:        #1f2937;

  /* Semantic */
  --color-muted:          #f9fafb;
  --color-muted-fg:       #6b7280;
  --color-accent:         #f0f0ff;    /* Hover tints */
  --color-accent-fg:      #7c3aed;
  --color-destructive:    #dc2626;    /* Red for delete/danger */
  --color-destructive-fg: #ffffff;

  /* Structural */
  --color-border:         #e5e7eb;
  --color-input:          #ffffff;
  --color-ring:           #7c3aed;    /* Focus outline */
}
```

### Structural Tokens

#### Spacing (8 values)

```
--spacing-xs:   4px
--spacing-sm:   8px
--spacing-md:   16px
--spacing-lg:   24px
--spacing-xl:   32px
```

#### Border Radius (4 values)

```
--border-radius-s:    2px
--border-radius-m:    6px
--border-radius-l:    8px
--border-radius-full: 9999px
```

#### Font Sizes

Heading:
```
--heading-font-size-s:  16px
--heading-font-size-m:  20px
--heading-font-size-l:  28px
--heading-font-size-xl: 32px
```

Body:
```
--body-font-size-xs: 12px
--body-font-size-s:  14px  (default)
--body-font-size-m:  16px
--body-font-size-l:  18px
```

#### Shadows (4 values)

```
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 20px 25px rgba(0, 0, 0, 0.15)
```

#### Transitions

```
--transition-fast:   150ms ease-out
--transition-normal: 250ms ease-out
--transition-slow:   400ms ease-out
```

#### Typography

```
--body-font-family: system-ui, -apple-system, sans-serif
--heading-font-family: var(--body-font-family)  (same by default)
```

---

## CSS Writing Patterns

### Pattern 1: Basic Block

```css
main .my-block {
  /* Root styles */
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-card);
  border-radius: var(--border-radius-m);
  box-shadow: var(--shadow-sm);
  
  /* Children */
  & h2 {
    margin: 0;
    font-size: var(--heading-font-size-m);
    color: var(--color-fg);
  }
  
  & p {
    color: var(--color-muted-fg);
    margin: 0;
  }
  
  & button {
    align-self: start;
  }
}
```

### Pattern 2: Responsive Layout

Mobile-first, then tablet+ overrides:

```css
main .my-block {
  /* Mobile: single column */
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  
  /* Tablet and up: two columns */
  @media (width >= 768px) {
    flex-direction: row;
    gap: var(--spacing-lg);
  }
  
  /* Desktop: three columns */
  @media (width >= 1024px) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Pattern 3: Variant Modifiers

```css
main .my-block {
  padding: var(--spacing-md);
  
  /* Compact variant: less padding */
  & &.compact {
    padding: var(--spacing-sm);
  }
  
  /* Dark theme variant */
  & &.dark {
    background: var(--color-muted);
    color: var(--color-muted-fg);
  }
  
  /* Disabled state */
  & &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}
```

### Pattern 4: Interactive States

```css
main .my-block {
  & button {
    background: var(--color-primary);
    color: var(--color-primary-fg);
    border: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-m);
    cursor: pointer;
    transition: background var(--transition-normal);
    
    /* Hover */
    &:hover {
      background: var(--color-accent);
      color: var(--color-accent-fg);
    }
    
    /* Focus (keyboard navigation) */
    &:focus-visible {
      outline: 2px solid var(--color-ring);
      outline-offset: 2px;
    }
    
    /* Active / pressed state */
    &:active {
      transform: scale(0.98);
    }
    
    /* Disabled */
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
```

### Pattern 5: Layout with Grid

```css
main .my-block {
  display: grid;
  grid-template-columns: auto 1fr;  /* Label | content */
  gap: var(--spacing-md) var(--spacing-lg);
  
  & dt {
    font-weight: 600;
    color: var(--color-fg);
  }
  
  & dd {
    margin: 0;
    color: var(--color-muted-fg);
  }
}
```

---

## Creating a New Theme

Themes override only the 16 `--color-*` tokens. Never override structural tokens.

### Step 1: Create Theme CSS File

```
styles/themes/my-brand.css
```

### Step 2: Define Semantic Tokens

```css
/* styles/themes/my-brand.css */
.theme-my-brand {
  /* Primary brand color */
  --color-primary:        #dc2626;   /* Red for brand */
  --color-primary-fg:     #ffffff;

  /* Neutrals from brand palette */
  --color-bg:             #fafaf9;   /* Warm off-white */
  --color-fg:             #292524;   /* Dark brown */
  --color-card:           #ffffff;
  --color-card-fg:        #292524;

  /* Secondary from brand */
  --color-secondary:      #fed7aa;
  --color-secondary-fg:   #92400e;

  /* Muted (subtle) */
  --color-muted:          #f5f5f4;
  --color-muted-fg:       #78716c;

  /* Accent: hover states */
  --color-accent:         #fecaca;
  --color-accent-fg:      #dc2626;

  /* Destructive: keep red/orange for delete */
  --color-destructive:    #ea580c;
  --color-destructive-fg: #ffffff;

  /* Structural */
  --color-border:         #d6d3d1;
  --color-input:          #ffffff;
  --color-ring:           #dc2626;   /* Brand red for focus */
}
```

### Step 3: Activate in Configuration

```js
// scripts/asc/configurations.js
theme: { default: 'my-brand' }
```

### Step 4: Verify Rendering

```bash
aem up --no-open
# Visit http://localhost:3000
# Check that colors match the new theme
```

---

## Theme Recommendations

### Naming Convention

Use `.theme-{name}` CSS class to define a theme:

```css
.theme-dark { --color-bg: #000; ... }
.theme-light { --color-bg: #fff; ... }
.theme-brand { --color-primary: #brand-color; ... }
```

### Required Tokens

Every theme **must** define all 16 color tokens. Copy the template and customize.

### Semantic Meaning

When defining a theme:
- `--color-primary` should be your brand's main action color
- `--color-destructive` should typically stay red/orange (users expect red for danger)
- `--color-muted` should be a subtle background (for disabled states, secondary text)
- `--color-ring` should be distinct for keyboard focus (usually same as primary or darker shade)

### Contrast

Ensure sufficient contrast per WCAG AA standards:
- Foreground on background: at least 4.5:1 for text
- Button text on button background: at least 4.5:1
- Border on background: at least 3:1

Use a [contrast checker](https://webaim.org/resources/contrastchecker/) to verify.

---

## Built-in Themes

ASC ships with these themes:

| Name | Description |
|------|---|
| `default` | Violet Studio (purple primary) |
| `dark` | Deep Ocean (dark bg, light text) |
| `studio` | Unsplash (minimal, warm) |

Located in `styles/themes/`.

---

## Common CSS Mistakes

| Mistake | Why Wrong | Fix |
|---------|-----------|-----|
| Using bare `h2 { }` selector | Not scoped to block; affects all h2s on page | Use `main .my-block & h2 { }` nesting |
| Using hardcoded colors | Can't be overridden by themes; breaks consistency | Use `var(--color-*)` tokens |
| Using `--background-color` or `--text-color` | Old names removed in Phase 2 | Use `--color-bg`, `--color-fg`, etc. |
| Using `@media (max-width: 767px)` | Desktop-first, backwards | Use `@media (width >= 768px)` for tablet+ |
| Creating new color tokens in block CSS | Defeats the theme system | Define in `styles/tokens.css` or in a theme file |
| Mixing CSS nesting with separate rules | Less maintainable | Use CSS nesting consistently |
| Forgetting `var()` in colors | Token system is bypassed | Always: `background: var(--color-card);` |
| Using `!important` | Breaks cascade; hard to override | Restructure selectors instead |

---

## CSS File Organization

```
styles/
  tokens.css          ← All semantic tokens (read-only)
  styles.css          ← Global styles, button utilities, resets
  lazy-styles.css     ← Lazy-loaded styles
  fonts.css           ← @font-face declarations
  themes/
    dark.css          ← Dark theme override
    studio.css        ← Studio theme override
    custom.css        ← Custom user theme
  sections/
    grid.css          ← Grid section layout
    full-width.css    ← Full-width section layout
    aside.css         ← Aside (sidebar) section layout
```

Block CSS lives alongside the JS:

```
blocks/
  my-block/
    my-block.js       ← Block logic
    my-block.css      ← Block styles (scoped to main .my-block)
```

Part CSS lives alongside the JS:

```
scripts/asc/core/parts/
  my-part/
    my-part.js        ← Part function
    my-part.css       ← Part styles (scoped to .asc-my-part)
```

---

## Debugging CSS

### Styles not applying?

1. Check selector — is it under `main .block-name`?
2. Verify CSS file is imported (check Network tab in DevTools)
3. Look for typos in class name or property name
4. Check if a theme is overriding your tokens

### Responsive not working?

1. Check media query syntax: `@media (width >= 768px)` (not `min-width`)
2. Verify viewport is actually at that breakpoint (DevTools toggle device mode)
3. Check for conflicting CSS from EDS or global styles

### Color looks wrong?

1. Check if a theme is applied (look at `<body class="theme-dark">` in inspector)
2. Inspect computed styles in DevTools to see which token is applied
3. Check token value in `styles/tokens.css` or the theme file
4. Verify contrast is sufficient

---

## Links & Resources

- [Tokens CSS Reference](../../styles/tokens.css)
- [Main Styles](../../styles/styles.css)
- [CSS Convention Doc](../CSS_CONVENTION.md) — full conventions
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [CSS Nesting MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Nesting)

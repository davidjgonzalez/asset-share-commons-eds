---
name: asc-theme-from-website
description: Extract design tokens from a website and generate ASC themes
instructions: Extract CSS color tokens from a target website using Playwright, map them to ASC semantic tokens, and generate a new theme CSS file ready to use in configurations.js
related: asc-development, asc-theme-from-website
category: Theming
---

# ASC Theme Generator — Extract from Website

Generate new ASC themes by analyzing colors from an existing website.

## What It Does

This skill:
1. **Analyzes** a target website using Playwright
2. **Extracts** CSS colors from key DOM elements (headers, buttons, links, cards)
3. **Maps** extracted colors to ASC semantic tokens (primary, secondary, muted, accent, destructive)
4. **Generates** a new theme CSS file
5. **Previews** the theme and guides activation

## When to Use

- Creating a new brand theme (e.g., your company's colors)
- Matching an existing website's design system
- Rapid prototyping themes without manual color picking
- Maintaining color consistency across properties

## How to Use

### Step 1: Identify Target Website

Provide a URL with distinctive color patterns:

```
Example URLs:
  https://www.adobe.com
  https://netflix.com
  https://github.com
  your-brand-website.com
```

The tool analyzes:
- Header/navigation backgrounds and text
- Primary buttons and links
- Card backgrounds and borders
- Secondary UI elements
- Text on different backgrounds

### Step 2: Run Analysis

```bash
# Inside ASC workspace
node scripts/extract-design-tokens.js --url https://target-website.com --theme my-brand
```

**Output**:
```
✓ Extracted colors:
  Primary:      #1f2937 (from buttons)
  Secondary:    #f3f4f6 (from cards)
  Accent:       #0ea5e9 (from links)
  Muted:        #9ca3af (from secondary text)
  
✓ Generated theme:
  styles/themes/my-brand.css
  
✓ Updated configurations:
  scripts/asc/configurations.js (theme.default = 'my-brand')
  
→ Preview: aem up --no-open
→ Visit: http://localhost:3000?theme=my-brand
```

### Step 3: Preview & Refine

After generation, start the dev server and check the theme:

```bash
aem up --no-open
# Open http://localhost:3000 and check how the new theme looks
```

If colors don't match your vision:
- Manually edit `styles/themes/my-brand.css`
- Adjust token values
- Refresh page to see changes instantly

### Step 4: Activate Theme

Make the theme the default:

```js
// scripts/asc/configurations.js
theme: { default: 'my-brand' }
```

Then deploy:

```bash
npm run lint          # Verify no CSS errors
git add -A
git commit -m "Add my-brand theme"
git push
```

---

## Advanced Options

### Extract from Specific Element

Focus on a particular UI region:

```bash
node scripts/extract-design-tokens.js \
  --url https://website.com \
  --theme my-brand \
  --selector "header, .hero-section, .cta-button"
```

### Manual Color Overrides

Edit the generated theme to override extracted colors:

```css
/* styles/themes/my-brand.css */
.theme-my-brand {
  /* Extracted colors */
  --color-primary:    #1f2937;
  --color-secondary:  #f3f4f6;
  
  /* Manual overrides for better contrast */
  --color-primary-fg: #ffffff;  /* Was auto-detected too light */
  --color-destructive: #dc2626;  /* Override for safety */
}
```

### Multiple Theme Generation

Generate several themes from different sources:

```bash
node scripts/extract-design-tokens.js --url https://adobe.com --theme adobe
node scripts/extract-design-tokens.js --url https://github.com --theme github
node scripts/extract-design-tokens.js --url https://notion.so --theme notion
```

Then switch between them in `scripts/asc/configurations.js`:

```js
theme: { 
  default: 'adobe',
  // Users can switch: ?theme=github
}
```

---

## How Extraction Works

The tool:

1. **Opens** the website in Playwright
2. **Identifies** key UI elements:
   - `header`, `nav` → primary colors
   - `button`, `a` → accent, primary colors
   - `.card`, `.panel` → secondary, background colors
   - `p`, `span`, `text` → text colors (fg)
3. **Computes** `getComputedStyle()` for each element
4. **Filters** colors (removes grays, white, black unless intentional)
5. **Clusters** similar colors and picks the most prominent
6. **Maps** to ASC tokens using heuristics:
   - Bright/saturated → `--color-primary`
   - Light/desaturated → `--color-secondary` or `--color-muted`
   - Different from primary → `--color-accent`
   - Red/orange tones → `--color-destructive`

---

## Token Mapping Reference

| Extracted Element | Maps to ASC Token | Rationale |
|---|---|---|
| Button background (CTA) | `--color-primary` | Main action color |
| Header background | `--color-secondary` | Less prominent container |
| Link color | `--color-accent` or `--color-primary` | Interactive element |
| Card background | `--color-card` | Content container |
| Disabled state | `--color-muted` | Subtle/inactive state |
| Danger button | `--color-destructive` | Red = danger |
| Body text | `--color-fg` | Default text |
| Secondary text | `--color-muted-fg` | Dimmed text |
| Borders | `--color-border` | UI dividers |

---

## Generated Theme Structure

The tool creates a theme file like:

```css
/* styles/themes/my-brand.css */
.theme-my-brand {
  /* Primary & Secondary */
  --color-primary:        #1f2937;   /* Extracted from buttons */
  --color-primary-fg:     #ffffff;   /* Auto-detected for contrast */
  --color-secondary:      #f3f4f6;   /* Extracted from cards */
  --color-secondary-fg:   #1f2937;

  /* Backgrounds */
  --color-bg:             #ffffff;   /* Page background */
  --color-fg:             #1f2937;   /* Body text */
  --color-card:           #ffffff;
  --color-card-fg:        #1f2937;

  /* Semantic */
  --color-muted:          #f9fafb;
  --color-muted-fg:       #6b7280;
  --color-accent:         #dbeafe;   /* Extracted from highlights */
  --color-accent-fg:      #1e40af;

  --color-destructive:    #dc2626;   /* Red for danger */
  --color-destructive-fg: #ffffff;

  /* Structural */
  --color-border:         #e5e7eb;
  --color-input:          #ffffff;
  --color-ring:           #1f2937;   /* Focus outline (primary) */
}
```

All 16 tokens are generated and ready to use.

---

## Troubleshooting

**Colors look wrong?**
- Website might use design patterns the tool can't detect
- Try specifying `--selector` to focus on specific areas
- Manually tweak token values in the generated CSS

**No colors extracted?**
- Website might be heavily JavaScript-rendered (needs wait time)
- Try a different domain with more visible static colors
- Check `--selector` targets actual colored elements

**Theme doesn't apply?**
- Verify `scripts/asc/configurations.js` has `theme: { default: 'my-brand' }`
- Restart `aem up` after editing configurations.js
- Clear browser cache (DevTools → Settings → Network → Disable cache)

**Contrast issues?**
- Generated `--color-*-fg` might not meet WCAG AA
- Edit the CSS and adjust manually (lighter or darker)
- Use [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/) to verify

---

## Examples

### Example 1: Extract Adobe.com Colors

```bash
node scripts/extract-design-tokens.js \
  --url https://www.adobe.com \
  --theme adobe-official
```

Creates `styles/themes/adobe-official.css` with Adobe's brand colors automatically mapped.

### Example 2: Extract and Tweak

```bash
node scripts/extract-design-tokens.js \
  --url https://github.com \
  --theme github-inspired
```

Then edit `styles/themes/github-inspired.css`:

```css
.theme-github-inspired {
  /* Extracted colors look good, but adjust destructive for safety */
  --color-destructive: #f85149;  /* GitHub's red */
  --color-ring: #1f6feb;         /* GitHub's focus blue */
}
```

### Example 3: Multiple Brands

```bash
# Generate all at once
for url in adobe.com netflix.com spotify.com; do
  node scripts/extract-design-tokens.js --url "https://$url" --theme ${url%.*}
done
```

Creates themes: `adobe.css`, `netflix.css`, `spotify.css`.

---

## Next Steps

1. **Generate** a theme: `node scripts/extract-design-tokens.js --url ...`
2. **Preview** in browser: `aem up --no-open` → `http://localhost:3000`
3. **Refine** colors in `styles/themes/{name}.css` if needed
4. **Activate** in `scripts/asc/configurations.js`
5. **Deploy**: `npm run lint && git push`

All ASC blocks automatically adapt to the new theme via CSS variables.

---

## Related Documentation

- [CSS Guidelines](../asc-development/references/css-guidelines.md) — Token reference, theme creation
- [FUTURE_STATE_ARCHITECTURE.md](../docs/FUTURE_STATE_ARCHITECTURE.md) — Design token strategy
- [Block Conventions](../asc-development/references/block-conventions.md) — How blocks use tokens

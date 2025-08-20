# Asset Share Commons - Theming System

## Overview

The Asset Share Commons theming system provides a comprehensive, CSS-variable-based approach to styling and theming components. It allows for easy customization, consistent design patterns, and multiple theme support.

## Features

- **CSS Variable System**: Centralized design tokens for consistent styling
- **Multiple Themes**: Built-in support for Default, Dark, and Warm themes
- **Theme Switching**: Dynamic theme switching with localStorage persistence
- **Component Scoping**: Block-specific CSS with proper scoping
- **CSS Nesting**: Modern CSS nesting for better organization
- **Responsive Design**: Mobile-first responsive design patterns
- **Accessibility**: Built-in accessibility features and media queries

## Quick Start

### 1. Load the Theme System

Include the theme CSS files in your HTML:

```html
<link rel="stylesheet" href="/styles/styles.css">
<link rel="stylesheet" href="/styles/themes/default.css">
<link rel="stylesheet" href="/styles/themes/dark.css">
<link rel="stylesheet" href="/styles/themes/warm.css">
```

### 2. Initialize the Theme Manager

```javascript
import { themeManager } from './scripts/asc/utils/theme.js';

// Theme manager automatically initializes and adds theme toggle
// You can also programmatically change themes:

themeManager.setTheme('dark');
themeManager.setTheme('warm');
themeManager.setTheme('default');
```

### 3. Apply Themes to HTML

Themes are applied via CSS classes on the body element:

```html
<body class="theme-default">  <!-- Default theme -->
<body class="theme-dark">      <!-- Dark theme -->
<body class="theme-warm">      <!-- Warm theme -->
```

## Available Themes

### Default Theme
- Clean, professional design
- Blue accent colors
- High contrast
- Ideal for corporate applications

### Dark Theme
- Modern dark interface
- Blue highlights
- Reduced eye strain
- Perfect for modern aesthetics

### Warm Theme
- Friendly, earthy colors
- Orange accents
- Approachable feel
- Great for creative applications

## CSS Variables

### Core Variables

```css
/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;
--spacing-3xl: 64px;

/* Border Radius */
--border-radius-sm: 4px;
--border-radius-md: 8px;
--border-radius-lg: 12px;
--border-radius-xl: 16px;
--border-radius-full: 9999px;

/* Shadows */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

/* Transitions */
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 350ms ease;
```

### Component Variables

```css
/* Search Bar */
--search-border-color: #d1d5db;
--search-background: #fff;
--search-text-color: #374151;
--search-primary-color: #2563eb;

/* Cards */
--card-background: #fff;
--card-border-color: #e5e7eb;
--card-shadow: var(--shadow-sm);
--card-shadow-hover: var(--shadow-md);

/* Buttons */
--button-primary-bg: var(--link-color);
--button-primary-text: var(--background-color);
--button-primary-hover: var(--link-hover-color);

/* Form Inputs */
--input-border-color: #d1d5db;
--input-border-focus: var(--search-primary-color);
--input-background: #fff;
--input-text-color: var(--text-color);
--input-placeholder-color: #9ca3af;
--input-border-color-hover: #9ca3af;
--input-border-color-error: #ef4444;
--input-border-color-success: #10b981;
--input-border-color-disabled: #e5e7eb;
--input-focus-ring-color: rgba(37, 99, 235, 0.1);

/* Checkbox & Radio */
--checkbox-border-color: var(--input-border-color);
--checkbox-border-color-checked: var(--search-primary-color);
--checkbox-background-checked: var(--search-primary-color);
--checkbox-color: var(--background-color);

/* Select/Dropdown */
--select-arrow-color: var(--input-text-color);
--select-option-background: var(--input-background);
--select-option-background-hover: var(--light-color);
--select-option-text-color: var(--input-text-color);

/* Form Validation */
--validation-error-color: #ef4444;
--validation-success-color: #10b981;
--validation-warning-color: #f59e0b;
--validation-info-color: #3b82f6;
```

## Block CSS Convention

### 1. Block Selector Pattern

```css
.block.<block-name> {
  /* Block styles */
}
```

### 2. CSS Nesting

```css
.block.search-bar {
  /* Block Container */
  width: 100%;
  max-width: 600px;
  
  /* Child Elements */
  .search-input {
    padding: var(--spacing-md);
    
    &::placeholder {
      color: var(--search-placeholder-color);
    }
  }
  
  /* Modifiers */
  &.large {
    .search-input {
      padding: var(--spacing-lg);
    }
  }
}
```

### 3. Responsive Design

```css
.block.hero {
  /* Mobile styles (default) */
  padding: var(--spacing-lg);
  
  /* Tablet and up */
  @media (width >= 768px) {
    padding: var(--spacing-xl);
  }
  
  /* Desktop and up */
  @media (width >= 1024px) {
    padding: var(--spacing-2xl);
  }
}
```

## Creating Custom Themes

### 1. Create Theme CSS File

Create a new file in `styles/themes/`:

```css
/* Custom Theme */
.theme-custom {
  /* Colors */
  --background-color: #f0f0f0;
  --text-color: #333333;
  --link-color: #ff6b6b;
  
  /* Component Colors */
  --search-border-color: #cccccc;
  --search-background: #ffffff;
  --search-primary-color: #ff6b6b;
  
  --card-background: #ffffff;
  --card-border-color: #e0e0e0;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

### 2. Add to Theme Manager

Update `scripts/asc/utils/theme.js`:

```javascript
constructor() {
  this.currentTheme = 'default';
  this.themes = ['default', 'dark', 'warm', 'custom']; // Add your theme
  this.init();
}
```

### 3. Include in HTML

```html
<link rel="stylesheet" href="/styles/themes/custom.css">
```

## Theme Manager API

### Methods

```javascript
// Get current theme
const currentTheme = themeManager.getCurrentTheme();

// Set theme
themeManager.setTheme('dark');

// Get available themes
const themes = themeManager.getAvailableThemes();

// Listen for theme changes
document.addEventListener('asc:theme:changed', (event) => {
  const { theme } = event.detail;
  console.log('Theme changed to:', theme);
});
```

### Events

- `asc:theme:changed`: Fired when theme changes
  - `event.detail.theme`: New theme name

## File Structure

```
styles/
├── styles.css              # Main styles with CSS variables
├── themes/
│   ├── default.css         # Default theme
│   ├── dark.css           # Dark theme
│   └── warm.css           # Warm theme
└── blocks/
    ├── search-bar/
    │   └── search-bar.css  # Block-specific styles
    ├── hero/
    │   └── hero.css        # Block-specific styles
    └── cards/
        └── cards.css       # Block-specific styles

scripts/asc/utils/
└── theme.js                # Theme management utility
```

## Best Practices

### 1. Always Use CSS Variables
```css
/* ✅ Good */
padding: var(--spacing-md);
color: var(--text-color);

/* ❌ Avoid */
padding: 16px;
color: #333;
```

### 2. Use Block Scoping
```css
/* ✅ Good */
.block.search-bar .search-input { }

/* ❌ Avoid */
.search-input { }
```

### 3. Include Accessibility Features
```css
/* High contrast mode */
@media (prefers-contrast: high) { }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) { }

/* Focus styles */
:focus { }
```

### 4. Mobile-First Responsive Design
```css
/* Start with mobile styles */
.block.hero {
  padding: var(--spacing-lg);
}

/* Then add larger screen styles */
@media (width >= 768px) {
  .block.hero {
    padding: var(--spacing-xl);
  }
}
```

## Examples

### Demo Pages

- `theme-demo.html` - Complete theme demonstration
- `search-example.html` - Search functionality with theming

### Running the Demos

1. Open `theme-demo.html` in a browser
2. Use the theme toggle button (🎨) to switch themes
3. Observe how components change appearance
4. Check the browser console for theme change events

## Browser Support

- **CSS Variables**: Modern browsers (IE11+ with polyfill)
- **CSS Nesting**: Modern browsers (Chrome 112+, Firefox 117+)
- **CSS Container Queries**: Modern browsers (Chrome 105+, Firefox 110+)

## Troubleshooting

### Theme Not Loading
- Check that theme CSS files are properly linked
- Verify theme class is applied to body element
- Check browser console for errors

### Styles Not Applying
- Ensure block has correct CSS class (`.block.<block-name>`)
- Verify CSS variables are defined in theme
- Check CSS specificity and scoping

### Theme Toggle Not Working
- Verify theme manager is imported and initialized
- Check that theme toggle HTML is generated
- Ensure localStorage is available

## Contributing

When adding new themes or components:

1. Follow the CSS convention guide
2. Use existing CSS variables when possible
3. Add new variables to the main `styles.css` file
4. Update the theme manager if adding new themes
5. Test across different themes and screen sizes
6. Include accessibility features
7. Add print styles where appropriate

## License

This theming system is part of Asset Share Commons and follows the same licensing terms.

## Form Input Theming

The theming system includes comprehensive support for all form input types, ensuring consistent styling and behavior across different themes.

### Form Input Types Supported

- **Text Inputs**: `input[type="text"]`, `input[type="email"]`, `input[type="password"]`, etc.
- **Textarea**: Multi-line text input
- **Select Dropdowns**: Single and multiple selection
- **Checkboxes**: Custom styled checkboxes with themes
- **Radio Buttons**: Custom styled radio buttons with themes
- **Input Groups**: Combined inputs (e.g., country code + phone number)
- **Form Layout**: Responsive grid layouts

### Form Input Classes

```css
/* Wrapper Classes for Scoping */
.form-group          /* Input group container */
.input-group         /* Combined inputs (e.g., country code + phone) */
.checkbox-group      /* Checkbox wrapper for custom styling */
.radio-group         /* Radio button wrapper for custom styling */
.help-text           /* Help text below inputs */
.form-validation     /* Validation messages */

/* Modifier Classes (Use Sparingly) */
.small               /* Small input size */
.large               /* Large input size */
.error               /* Error state */
.success             /* Success state */
```

### Form Input Features

#### 1. **Input States**
- **Normal**: Default appearance (no classes needed)
- **Focus**: Highlighted with focus ring (automatic)
- **Hover**: Subtle border color change (automatic)
- **Error**: Red border with error styling (`.error` class)
- **Success**: Green border with success styling (`.success` class)
- **Disabled**: Grayed out with disabled cursor (automatic)

#### 2. **Input Sizes**
- **Small**: Compact input for tight spaces (`.small` class)
- **Medium**: Default size for most use cases (no class needed)
- **Large**: Prominent input for important fields (`.large` class)

#### 3. **Input Variants**
- **Input Groups**: Combine multiple inputs using `.input-group`
- **Input with Icons**: Add icons to inputs using `.input-with-icon`
- **Responsive Layout**: Grid-based form layouts using `.form-row` and `.form-column`

#### 4. **Accessibility Features**
- **Focus Indicators**: Clear focus rings for keyboard navigation (automatic)
- **High Contrast Mode**: Enhanced borders for accessibility (automatic)
- **Reduced Motion**: Respects user motion preferences (automatic)
- **Screen Reader Support**: Proper labeling and ARIA attributes (semantic HTML)

### Form Input Usage Examples

#### Basic Text Input
```html
<div class="form-group">
  <label for="email">Email Address</label>
  <input type="email" id="email" placeholder="Enter your email">
  <div class="help-text">We'll never share your email with anyone else.</div>
</div>
```

#### Checkbox Input
```html
<div class="form-group">
  <label>Terms and Conditions</label>
  <div class="checkbox-group">
    <input type="checkbox" id="terms" name="terms" required>
    <span class="checkbox-custom"></span>
    <label class="checkbox-label" for="terms">I agree to the terms and conditions</label>
  </div>
</div>
```

#### Radio Button Group
```html
<div class="form-group">
  <label>Preferred Contact Method</label>
  <div class="radio-group">
    <input type="radio" id="email-contact" name="contact" value="email">
    <span class="radio-custom"></span>
    <label class="radio-label" for="email-contact">Email</label>
  </div>
  <div class="radio-group">
    <input type="radio" id="phone-contact" name="contact" value="phone">
    <span class="radio-custom"></span>
    <label class="radio-label" for="phone-contact">Phone</label>
  </div>
</div>
```

#### Input Group
```html
<div class="form-group">
  <label>Phone Number</label>
  <div class="input-group">
    <select style="max-width: 120px;">
      <option value="+1">+1</option>
      <option value="+44">+44</option>
    </select>
    <input type="tel" placeholder="Phone number">
  </div>
</div>
```

#### Form Layout
```html
<form class="form-layout">
  <div class="form-row">
    <div class="form-column">
      <div class="form-group">
        <label for="first-name">First Name</label>
        <input type="text" id="first-name" placeholder="First name">
      </div>
    </div>
    
    <div class="form-column">
      <div class="form-group">
        <label for="last-name">Last Name</label>
        <input type="text" id="last-name" placeholder="Last name">
      </div>
    </div>
  </div>
</form>
```

### Form Input Theming

Each theme provides specific colors and styling for form inputs:

#### Default Theme
- Clean, professional appearance
- Blue focus states and validation colors
- High contrast for accessibility

#### Dark Theme
- Dark backgrounds with blue accents
- Reduced eye strain
- Modern, sleek appearance

#### Warm Theme
- Friendly, earthy color palette
- Orange primary colors
- Approachable, comfortable feel

### Form Input Best Practices

1. **Target HTML elements directly**: Use `input`, `textarea`, `select`, `label` instead of custom classes
2. **Use wrapper classes for scoping**: `.form-group`, `.input-group`, `.checkbox-group` for logical grouping
3. **Use modifier classes sparingly**: Only for states (`.error`, `.success`) and sizes (`.small`, `.large`)
4. **Include proper ARIA attributes**: `aria-describedby`, `aria-invalid`, `aria-required`
5. **Use consistent spacing**: Leverage CSS variables for margins and padding
6. **Include focus states**: Visible focus indicators for keyboard navigation
7. **Provide validation feedback**: Clear error and success states
8. **Support multiple input sizes**: Small, medium (default), and large variants
9. **Include help text**: Use `.help-text` class for descriptive text below inputs
10. **Group related inputs**: Use `.input-group` for related fields
11. **Responsive design**: Stack inputs on mobile devices
12. **Accessibility**: High contrast mode and reduced motion support

### Form Input Demo

See `form-demo.html` for a comprehensive demonstration of all form input types, states, and layouts across different themes.
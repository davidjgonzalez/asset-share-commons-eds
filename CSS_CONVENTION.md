# CSS Convention Guide

## Block CSS Styling Convention

### 1. Block Selector Pattern
```css
.block.<block-name> {
  /* Block styles */
}
```

**Example:**
```css
.block.search-bar {
  /* Search bar specific styles */
}

.block.hero {
  /* Hero block specific styles */
}
```

### 2. CSS Nesting Structure
Use CSS nesting for better organization and scoping:

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
  
  /* Responsive */
  @media (max-width: 768px) {
    max-width: 100%;
  }
}
```

### 3. CSS Variables Usage
Always use CSS variables for:
- Colors
- Spacing
- Typography
- Shadows
- Transitions
- Border radius

**Available Variables:**
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

### 4. Component-Specific Variables
Use component-specific variables for consistent theming:

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

### 5. Modifier Classes
Use modifier classes for variants:

```css
.block.cards {
  /* Base styles */
  
  /* Layout modifiers */
  &.grid-2 { grid-template-columns: repeat(2, 1fr); }
  &.grid-3 { grid-template-columns: repeat(3, 1fr); }
  &.grid-4 { grid-template-columns: repeat(4, 1fr); }
  
  /* Size modifiers */
  .card.small { /* small card styles */ }
  .card.large { /* large card styles */ }
}
```

### 6. Responsive Design
Use consistent breakpoints and mobile-first approach:

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

### 7. Accessibility
Include accessibility features:

```css
/* High contrast mode */
@media (prefers-contrast: high) {
  .block.search-bar .search-input-container {
    border-width: 2px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .block.cards .card {
    transition: none;
  }
}

/* Focus styles */
.block.search-bar .search-input:focus {
  outline: 2px solid var(--search-primary-color);
  outline-offset: 2px;
}
```

### 8. Print Styles
Include print-specific styles:

```css
@media print {
  .block.cards .card {
    break-inside: avoid;
    box-shadow: none;
    border: 1px solid var(--text-color);
  }
}
```

### 9. Form Input Styling
Use semantic HTML elements with wrapper classes for scoping:

#### Form Input Structure
```css
.block.form-example {
  /* Form Group - Wrapper for logical grouping */
  .form-group {
    margin-bottom: var(--form-group-margin-bottom);
  }
  
  /* Form Labels - Target HTML elements directly */
  .form-group label {
    display: block;
    color: var(--label-color);
    font-weight: var(--label-font-weight);
    margin-bottom: var(--form-group-label-margin-bottom);
  }
  
  /* Form Inputs - Target HTML elements directly */
  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group input[type="password"],
  .form-group input[type="tel"],
  .form-group input[type="url"],
  .form-group input[type="search"],
  .form-group input[type="number"],
  .form-group input[type="date"],
  .form-group input[type="time"],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: var(--input-border-width) solid var(--input-border-color);
    border-radius: var(--input-border-radius);
    background: var(--input-background);
    color: var(--input-text-color);
    transition: var(--input-transition);
    
    &:focus {
      outline: none;
      border-color: var(--input-border-color-focus);
      box-shadow: 0 0 0 var(--input-focus-ring-width) var(--input-focus-ring-color);
    }
    
    &:hover {
      border-color: var(--input-border-color-hover);
    }
    
    &:disabled {
      background: var(--light-color);
      border-color: var(--input-border-color-disabled);
      cursor: not-allowed;
    }
    
    &::placeholder {
      color: var(--input-placeholder-color);
    }
  }
  
  /* Input States - Use modifier classes */
  .form-group input.error,
  .form-group textarea.error,
  .form-group select.error {
    border-color: var(--input-border-color-error);
    
    &:focus {
      box-shadow: 0 0 0 var(--input-focus-ring-width) rgba(239, 68, 68, 0.1);
    }
  }
  
  .form-group input.success,
  .form-group textarea.success,
  .form-group select.success {
    border-color: var(--input-border-color-success);
    
    &:focus {
      box-shadow: 0 0 0 var(--input-focus-ring-width) rgba(16, 185, 129, 0.1);
    }
  }
  
  /* Input Sizes - Use modifier classes */
  .form-group input.small,
  .form-group textarea.small,
  .form-group select.small {
    height: var(--input-height-sm);
    padding: calc(var(--input-padding-y) * 0.75) calc(var(--input-padding-x) * 0.75);
    font-size: var(--body-font-size-xs);
  }
  
  .form-group input.large,
  .form-group textarea.large,
  .form-group select.large {
    height: var(--input-height-lg);
    padding: calc(var(--input-padding-y) * 1.25) calc(var(--input-padding-x) * 1.25);
    font-size: var(--body-font-size-m);
  }
  
  /* Checkbox Styling - Use wrapper classes for custom styling */
  .form-group .checkbox-group {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    
    input[type="checkbox"] {
      position: absolute;
      opacity: 0;
    }
    
    .checkbox-custom {
      width: var(--checkbox-size);
      height: var(--checkbox-size);
      border: var(--input-border-width) solid var(--checkbox-border-color);
      border-radius: var(--border-radius-sm);
      background: var(--input-background);
      margin-right: var(--spacing-sm);
      transition: var(--input-transition);
      
      &:checked {
        background: var(--checkbox-background-checked);
        border-color: var(--checkbox-border-color-checked);
      }
    }
    
    .checkbox-label {
      color: var(--input-text-color);
      cursor: pointer;
    }
  }
  
  /* Radio Button Styling - Use wrapper classes for custom styling */
  .form-group .radio-group {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    
    input[type="radio"] {
      position: absolute;
      opacity: 0;
    }
    
    .radio-custom {
      width: var(--radio-size);
      height: var(--radio-size);
      border: var(--input-border-width) solid var(--checkbox-border-color);
      border-radius: var(--border-radius-full);
      background: var(--input-background);
      margin-right: var(--spacing-sm);
      transition: var(--input-transition);
      
      &:checked {
        border-color: var(--checkbox-border-color-checked);
      }
    }
    
    .radio-label {
      color: var(--input-text-color);
      cursor: pointer;
    }
  }
  
  /* Input Groups - Use wrapper classes for layout */
  .input-group {
    display: flex;
    gap: var(--input-group-gap);
    
    input,
    textarea,
    select {
      flex: 1;
      margin-bottom: 0;
      
      &:not(:first-child) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
      }
      
      &:not(:last-child) {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
    }
  }
  
  /* Form Layout - Use wrapper classes for grid layout */
  .form-row {
    display: grid;
    gap: var(--spacing-lg);
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
  
  .form-column {
    display: flex;
    flex-direction: column;
  }
  
  /* Responsive Forms */
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
      gap: var(--spacing-md);
    }
    
    .input-group {
      flex-direction: column;
      gap: var(--spacing-xs);
      
      input,
      textarea,
      select {
        border-radius: var(--input-border-radius);
      }
    }
  }
}
```

#### Form Input Best Practices
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

### 10. File Organization
- Each block has its own CSS file: `blocks/<block-name>/<block-name>.css`
- Import block CSS in the block's JavaScript file
- Theme CSS files are in `styles/themes/`
- Main styles are in `styles/styles.css`

### 11. Naming Convention
- Use kebab-case for class names
- Use descriptive names that reflect the purpose
- Avoid generic names like `.container`, `.wrapper`
- Use semantic names like `.card-content`, `.search-input`

### Example Complete Block CSS
```css
/* Hero Block Styles */
.block.hero {
  /* Block Container */
  position: relative;
  padding: var(--spacing-2xl) var(--spacing-lg);
  min-height: 300px;

  /* Hero Content */
  h1 {
    max-width: 1200px;
    margin: 0 auto;
    color: var(--background-color);
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  /* Variants */
  &.large {
    min-height: 500px;
    padding: var(--spacing-3xl) var(--spacing-lg);
  }

  /* Responsive */
  @media (width >= 900px) {
    padding: var(--spacing-2xl) var(--spacing-xl);
  }

  /* Print */
  @media print {
    h1 {
      color: var(--text-color);
      text-shadow: none;
    }
  }
}
```

This convention ensures:
- Consistent styling across blocks
- Easy theming and customization
- Maintainable and readable code
- Proper scoping and organization
- Accessibility and responsive design
- Print-friendly layouts

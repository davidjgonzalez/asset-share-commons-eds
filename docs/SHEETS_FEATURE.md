# Sheets Feature Specification  
**Project:** Asset Share Commons  

> **Status**: ✅ Implemented. See [blocks/sheet/](../blocks/sheet/) for the Sheet block implementation and [blocks/collection/](../blocks/collection/) for collection management. Referenced in [ARCHITECTURE_ASSESSMENT.md](../docs/ARCHITECTURE_ASSESSMENT.md).

---

## Objective

Implement a feature called **“Sheets”** in Asset Share Commons that allows users to create and share curated, presentation-friendly views of assets. These are similar to "Asset Kits" in: https://opensource.adobe.com/asset-share-commons/pages/asset-kit/overview/

A Sheet is a lightweight webpage that combines:
- Editorial content (title, descriptions, sections)
- One or more lists of assets (from AEM Assets)

There are two types of Sheets to support:
1. **Collection-generated (ephemeral, URL-driven)**
2. **Authored (persisted in AEM)**

---

## Core Concept

A Sheet is a structured document with:
- A title
- An optional description
- One or more sections

Each section may contain:
- A subheading
- A description
- A list of assets

Sheets should support both:
- Simple layouts (single list of assets)
- Multi-section layouts (e.g., logos, videos, etc.)

---

## Feature 1: Collection-Generated Sheets (Primary Scope)

This is the main feature to implement.

### User Flow

1. User browses assets in Asset Share Commons  
2. User selects one or more assets  
3. User adds them to a collection  
4. User clicks **“Create Sheet”**  
5. A modal/dialog opens  
6. User inputs:  
   - Title (required)  
   - Description (optional)  
7. System generates a shareable URL  
8. Visiting that URL renders a Sheet page  

---

## Behavior Requirements

### 1. No Backend Persistence (v1)

- The Sheet should not be stored in a database  
- All required data must be passed via the URL  

---

### 2. URL-Driven State

The URL must encode:
- Title  
- Description  
- Hero image (default to use the first asset w/ an large/hi-res image rendition as a hero))
- List of asset references  
- Rendition configuration  

Requirements:
- Data must be compressed and encoded in the URL so they are shareable
- URL must stay within browser limits  
- Must be safe for sharing  

---

### 3. Rendering

The Sheet is rendered via an AEM page template.

At runtime:
1. Read encoded data from URL  
2. Decode and decompress it  
3. Validate structure  
4. Render:  
   - Title  
   - Description  
   - Asset list  
   - Assets using the allowed rendition(s)  

Asset data should be fetched dynamically from AEM Assets.

---

### 4. Asset List Rendering

- Display assets in a grid/list format  
- Use existing Asset Share Commons components where possible  
- Handle:
  - Missing assets  
  - Empty lists  
  - Invalid references  

---

### 5. Error Handling

The system must gracefully handle:
- Invalid or malformed URL data  
- Decode/decompression failures  
- Missing required fields  

Expected behavior:
- Show a user-friendly error state (not a crash)  

---

## Feature 2: Authored Sheets (Secondary Scope)

This is a secondary feature and can be simpler in v1.

### Behavior

Authors in AEM can:
- Create a page using a Sheet template  
- Add content using components  

### Static Sheet URL Board

To publish a fixed, authored page from an existing ASC sheet without re-entering its assets,
place `sheet-controls` and `board` on the page. Create the source collection in ASC, use Share
to copy its generated sheet URL, then author the board with:

```
| source    | sheet      |
| mode      | sheet-url  |
| sheet-url | https://example.com/sheets/?sheet=... |
```

The board extracts the encoded `sheet` parameter from `sheet-url` and renders it in read-only
mode. The sibling `sheet-controls` block detects the same value and provides working Download
and Copy Link controls. The pasted URL remains the source of truth, so it carries the collection
membership, board layout, notes, text elements, title, and expiration created at share time.

---

### Required Components

- Title  
- Text/description  
- Subheading  
- Asset list  

---

### Asset List (Authored)

#### Manual Mode (Required)
- Author provides asset IDs or paths  

#### Query Mode (Optional / Future)
- Author defines a search/filter  
- Assets are dynamically resolved  

---

### Renditions for Authored Sheets

Authored sheets should allow the author to specify which renditions are allowed for that sheet or section.

Possible configuration:
- List of allowed rendition names  
- Default/primary rendition  
- Optional fallback rendition behavior  

---

## Renditions Requirement

Sheets need a way to control which renditions are available for displayed assets.

### Authored Sheets

- Renditions are explicitly defined by the author  
- Can be configured per sheet or per asset list block  

---

### Collection-Generated Sheets

Rendition control must be handled differently for dynamic sheets.

Supported approaches:

1. **Page-level configuration**
   - The dynamic sheet template defines allowed renditions  
   - Configured via template or policy  

2. **URL-encoded selection (optional)**
   - The URL includes a selected rendition key  
   - Should remain lightweight  

3. **Hybrid approach**
   - URL selects a rendition  
   - Template defines what is allowed  

---

### Preferred v1 Approach

- Authored sheets: author-controlled renditions  
- Collection-generated sheets: template-configured renditions  

This avoids:
- Large URLs  
- Complex user flows  

---

## Integration Points

### Asset Share Commons

Responsible for:
- Asset discovery  
- Asset selection  
- Collection management  
- Sheet creation UI  
- URL generation  

---

### AEM

Responsible for:
- Sheet page template  
- Rendering logic  
- Component structure  
- Rendition configuration (template/policy level)  

---

### AEM Assets

Responsible for:
- Asset data  
- Asset references  
- Renditions  

---

## Constraints

- URL length must remain within browser-safe limits  
- Encoding and compression are required  
- Prefer asset IDs over paths  
- Avoid tight coupling between systems  
- Rendition handling must not excessively increase URL size  

---

## v1 Scope

### Include

- Collection-generated sheets  
- Modal UI for title and description  
- URL encoding and compression  
- AEM rendering template  
- Single asset list support  
- Basic error handling  
- Rendition configuration support  

---

### Exclude

- Backend persistence for sheets  
- Advanced query builder UI  
- Complex layouts  
- Fully dynamic per-asset rendition selection via URL  

---

## Expected Output from Claude Code

Claude Code should produce:

1. Implementation plan  
2. Frontend changes  
3. Encoding/decoding utilities  
4. AEM template requirements  
5. Rendition handling strategy  
6. Risk analysis:
   - URL size limits  
   - Data integrity  
   - Rendition complexity  

---

## Summary

This feature enables Asset Share Commons to support:

- Quick sharing of selected assets via generated URLs  
- Lightweight presentation pages without full authoring  
- Controlled rendition display  

It connects:
- Asset Share Commons (selection + creation)  
- AEM Assets (data + renditions)  
- AEM (rendering + authoring)  

The design prioritizes:
- No backend complexity (v1)  
- Reuse of existing systems  
- Simplicity and scalability  
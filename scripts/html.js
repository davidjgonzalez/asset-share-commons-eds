/** Escape a string for safe insertion as HTML text content. */
export function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Escape a string for safe insertion as an HTML attribute value. */
export function escAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * A structured property value returned by asset.getProperty().
 *
 * Property handlers may return a plain JS value OR a PropertyValue created
 * with propValue(). Plain values are automatically wrapped via toPropertyValue().
 *
 *   value.data  — raw JS value (string, array, object, …); use for logic
 *   value.html  — safe HTML string ready for innerHTML; use in blocks
 *   value.text  — plain-text representation; use for search / data-filter
 */
export class PropertyValue {
    constructor(data, html, text) {
        this.data = data;
        this.html = html;
        this.text = String(text ?? '');
    }
}

/**
 * Create a PropertyValue explicitly — for custom property handlers that need
 * to control their own HTML rendering (e.g. color swatches, custom chips).
 *
 * @param {*}      data  Raw JS value
 * @param {string} html  Safe HTML string (must already be escaped)
 * @param {string} text  Plain-text representation for search / data-filter
 */
export function propValue(data, html, text) {
    return new PropertyValue(data, html, text);
}

/**
 * Convert any raw property value to a PropertyValue.
 * Already-wrapped PropertyValues are returned as-is.
 *
 * Built-in conversions:
 *   null / undefined          → empty PropertyValue
 *   string / number / boolean → escaped text
 *   string[]                  → .asc-ui-chip-list  (text: joined with ", ")
 *   { hex, label }[]          → .asc-ui-swatch-list (text: labels joined with ", ")
 *   { width, height }         → "W × H"
 *
 * @param {*} raw
 * @returns {PropertyValue}
 */
export function toPropertyValue(raw) {
    if (raw instanceof PropertyValue) return raw;
    if (raw == null) return new PropertyValue(null, '', '');

    if (Array.isArray(raw)) {
        if (!raw.length) return new PropertyValue(raw, '', '');

        // Swatch array: [{ hex, label }, …]
        if (typeof raw[0] === 'object' && raw[0] !== null && 'hex' in raw[0]) {
            const swatches = raw.map(({ hex, label }) =>
                `<span class="asc-ui-swatch" style="--asc-ui-swatch-color:${escAttr(hex)}">`
                + `<span class="asc-ui-swatch__dot"></span>`
                + `<span class="asc-ui-swatch__label">${escHtml(label)}</span>`
                + `</span>`,
            ).join('');
            return new PropertyValue(raw, `<span class="asc-ui-swatch-list">${swatches}</span>`, raw.map((s) => s.label).join(', '));
        }

        // String chip array
        const chips = raw.map((v) => `<span class="asc-ui-chip">${escHtml(String(v).trim())}</span>`).join('');
        return new PropertyValue(raw, `<span class="asc-ui-chip-list">${chips}</span>`, raw.join(', '));
    }

    if (typeof raw === 'object') {
        if (raw.width != null && raw.height != null) {
            const str = `${raw.width} × ${raw.height}`;
            return new PropertyValue(raw, escHtml(str), str);
        }
        return new PropertyValue(raw, '', '');
    }

    const str = String(raw);
    return new PropertyValue(raw, escHtml(str), str);
}

/**
 * Render a property value as HTML, with an optional chip-list limit.
 *
 * Accepts either a PropertyValue or a raw value. When `limit` is set and the
 * value is a string array, chips beyond the limit are hidden behind a
 * "View more" button (block must wire up the toggle).
 *
 * @param {PropertyValue|*} value
 * @param {{ limit?: number }} [options]
 * @returns {string} Safe HTML string
 */
export function renderPropertyValue(value, { limit } = {}) {
    // Fast path: pre-rendered PropertyValue with no limit override needed
    if (value instanceof PropertyValue) {
        if (!limit || !Array.isArray(value.data) || value.data.length <= limit) return value.html;
        // Re-render with limit (chip arrays only; swatches fall through)
        value = value.data;
    }

    if (value == null) return '';

    if (Array.isArray(value)) {
        if (!value.length) return '';
        if (typeof value[0] === 'object' && value[0] !== null && 'hex' in value[0]) {
            return toPropertyValue(value).html;
        }
        const chip = (v) => `<span class="asc-ui-chip">${escHtml(String(v).trim())}</span>`;
        if (limit && value.length > limit) {
            const count = value.length - limit;
            return `<span class="asc-ui-chip-list">`
                + value.slice(0, limit).map(chip).join('')
                + `<span class="asc-ui-chip-extras is-hidden">${value.slice(limit).map(chip).join('')}</span>`
                + `</span>`
                + `<button class="asc-view-more-btn" type="button" aria-expanded="false" data-extras-count="${count}">View more (${count})</button>`;
        }
        return `<span class="asc-ui-chip-list">${value.map(chip).join('')}</span>`;
    }

    if (typeof value === 'object') {
        if (value.width != null && value.height != null) return escHtml(`${value.width} × ${value.height}`);
        return '';
    }

    return escHtml(String(value));
}

/**
 * Format an ISO timestamp as "Updated Jan 15, 2025".
 * @returns {{ iso: string, label: string } | null}
 */
export function formatUpdated(iso) {
    if (iso == null || iso === '') return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return {
        iso,
        label: `Updated ${d.toLocaleDateString(undefined, { dateStyle: 'medium' })}`,
    };
}

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

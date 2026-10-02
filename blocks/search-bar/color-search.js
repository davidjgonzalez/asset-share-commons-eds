/** @owner user */
/**
 * Color-search palette + nearest-match helper, used by the search-bar color picker
 * (blocks/search-bar/search-bar.js) and the `search.preprocessQuery` hook in
 * configurations.js that translates a picked color into an AEM QueryBuilder predicate.
 *
 * Adobe Smart Tags' color-extraction pipeline writes each asset's dominant colors to
 * jcr:content/metadata/dam:colorDistribution as a set of ranked child nodes — literally
 * named color1, color2, color3… (not a predictable/wildcardable path), each with an `rgb`
 * array and a `name` token (screaming-snake-case, e.g. "LIGHT_BLUE"). See
 * scripts/asc/core/services/properties/colors.js, which already reads this property for
 * display.
 *
 * The palette below was pulled directly from this instance's real asset metadata (not
 * guessed) — every `name` here is a token that's actually present on at least one asset,
 * confirmed by querying /bin/querybuilder.json directly. If you re-run asset ingestion
 * against a different AEM instance or Smart Tags configuration, re-verify these against
 * real metadata rather than assuming the taxonomy carries over.
 */

export const DEFAULT_PALETTE = [
  { label: 'Red',        hex: '#c90205', name: 'RED' },
  { label: 'Dark red',   hex: '#980202', name: 'DARK_RED' },
  { label: 'Orange',     hex: '#f2a978', name: 'ORANGE' },
  { label: 'Cream',      hex: '#ece7bb', name: 'CREAM' },
  { label: 'Olive',      hex: '#849c49', name: 'OLIVE' },
  { label: 'Mud green',  hex: '#3d610b', name: 'MUD_GREEN' },
  { label: 'Dark green', hex: '#224906', name: 'DARK_GREEN' },
  { label: 'Emerald',    hex: '#59855f', name: 'EMERALD' },
  { label: 'Cyan',       hex: '#c2dee4', name: 'CYAN' },
  { label: 'Light blue', hex: '#93beda', name: 'LIGHT_BLUE' },
  { label: 'Dark blue',  hex: '#212e3a', name: 'DARK_BLUE' },
  { label: 'Lavender',   hex: '#9caee2', name: 'LAVENDER' },
  { label: 'Pink',       hex: '#f196b8', name: 'PINK' },
  { label: 'Brown',      hex: '#926946', name: 'BROWN' },
  { label: 'Dark brown', hex: '#38291e', name: 'DARK_BROWN' },
  { label: 'Black',      hex: '#0e110d', name: 'BLACK' },
  { label: 'Dark gray',  hex: '#4b4b4b', name: 'DARK_GRAY' },
  { label: 'Gray',       hex: '#a5a8a7', name: 'GRAY' },
  { label: 'Silver',     hex: '#c9cbcc', name: 'SILVER' },
  { label: 'Off white',  hex: '#e6e6e8', name: 'OFF_WHITE' },
  { label: 'White',      hex: '#fcfcfc', name: 'WHITE' },
];

/**
 * Smart Tags writes a variable number of ranked color nodes per asset (color1, color2, …),
 * in no predictable order — the dominant color isn't always color1. This is the highest
 * rank observed on this instance (plus a small margin); the QB predicate in
 * configurations.js ORs across ranks 1..MAX_COLOR_RANK to match regardless of rank.
 */
export const MAX_COLOR_RANK = 8;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Sort the palette by Euclidean RGB distance to `hex`, nearest first.
 * @param {string} hex - e.g. "#3366cc"
 * @param {Array<{label,hex,name}>} [palette]
 * @returns {Array<{label: string, hex: string, name: string}>}
 */
export function sortByDistance(hex, palette = DEFAULT_PALETTE) {
  const [r, g, b] = hexToRgb(hex);
  return [...palette].sort((a, b2) => {
    const [ar, ag, ab] = hexToRgb(a.hex);
    const [br, bg, bb] = hexToRgb(b2.hex);
    const da = ((r - ar) ** 2) + ((g - ag) ** 2) + ((b - ab) ** 2);
    const db = ((r - br) ** 2) + ((g - bg) ** 2) + ((b - bb) ** 2);
    return da - db;
  });
}

/**
 * Find the single palette entry nearest to `hex` — used for UI feedback (the
 * swatch dot / color input snap to one definitive color). For searching, use
 * `nearestColors` instead so near-neighbor colors are also matched.
 * @param {string} hex
 * @param {Array<{label,hex,name}>} [palette]
 * @returns {{label: string, hex: string, name: string}}
 */
export function nearestColor(hex, palette = DEFAULT_PALETTE) {
  return sortByDistance(hex, palette)[0];
}

/**
 * Find the `count` palette entries nearest to `hex` — used to loosen color
 * search so visually similar named colors match too, not just the single
 * closest one (e.g. picking a blue-ish teal also matches "Cyan").
 * @param {string} hex
 * @param {Array<{label,hex,name}>} [palette]
 * @param {number} [count]
 * @returns {Array<{label: string, hex: string, name: string}>}
 */
export function nearestColors(hex, palette = DEFAULT_PALETTE, count = 3) {
  return sortByDistance(hex, palette).slice(0, count);
}

/** @owner user */
/**
 * details-map — displays an interactive Leaflet map centered on the asset's GPS capture
 * location. Hides itself completely when GPS metadata is absent or invalid.
 *
 * Leaflet and OpenStreetMap tiles are used — no API key required.
 * Leaflet is loaded from CDN only when this block is present on the page.
 *
 * GPS coordinate precision is preserved exactly as stored in metadata. Coordinates are
 * never rounded before being passed to Leaflet or used in external map links.
 *
 * Authoring (da.live table):
 *   | details-map |                                        |
 *   | latitude    | jcr:content/metadata/exif:GPSLatitude  |   (optional — default shown)
 *   | longitude   | jcr:content/metadata/exif:GPSLongitude |   (optional — default shown)
 *   | altitude    | jcr:content/metadata/exif:GPSAltitude  |   (optional — default shown)
 *   | label       | Location                               |   (optional)
 *   | zoom        | 10                                     |   (optional; default 10)
 */
import { readBlockConfig, loadCSS, loadScript } from '../../scripts/aem.js';
import Asset from '../../scripts/asc/models/asset.js';
import { escHtml } from '../../scripts/html.js';

const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export default async function decorate(block) {
  const config = readBlockConfig(block);
  const latProp = config.latitude || 'jcr:content/metadata/exif:GPSLatitude';
  const lonProp = config.longitude || 'jcr:content/metadata/exif:GPSLongitude';
  const altProp = config.altitude || 'jcr:content/metadata/exif:GPSAltitude';
  const label = config.label || 'Location';
  const zoom = parseInt(config.zoom, 10) || 10;

  const asset = await Asset.create(block);
  if (!asset) { block.innerHTML = ''; return; }

  // AEM EXIF metadata delivers coordinates as DMS strings e.g. "42,59.35N".
  // parseDMS converts to signed decimal degrees with full precision for Leaflet.
  const lat = parseDMS(asset.getProperty(latProp).data);
  const lon = parseDMS(asset.getProperty(lonProp).data);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90
    || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    block.innerHTML = '';
    return;
  }

  // Altitude is optional — block renders without it if the property is absent.
  // AEM stores GPSAltitude as a rational string ("150/1") or plain decimal ("150").
  const altMeters = parseRational(asset.getProperty(altProp).data);
  const altHtml = Number.isFinite(altMeters)
    ? `<p class="details-map__altitude">${escHtml(altMeters.toFixed(1))} m</p>`
    : '';

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

  block.innerHTML = `
    <p class="details-map__label">${escHtml(label)}</p>
    <div class="details-map__map" aria-label="Map showing asset capture location"></div>
    ${altHtml}
    <a class="details-map__link"
       href="${mapsUrl}"
       target="_blank"
       rel="noopener noreferrer"
       aria-label="Open location in Google Maps">Open in Google Maps</a>`;

  const mapContainer = block.querySelector('.details-map__map');

  try {
    loadCSS(LEAFLET_CSS);  // non-blocking — loads in parallel with JS
    await loadScript(LEAFLET_JS);
    initMap(mapContainer, lat, lon, zoom);
  } catch {
    // Leaflet failed to load — coordinate text and link remain as fallback
    mapContainer.remove();
  }
}

/**
 * Converts an AEM EXIF coordinate string to signed decimal degrees.
 *
 * AEM stores GPS coordinates in "degrees,decimal-minutes + direction" format:
 *   "42,59.35N"  →  42 + (59.35 / 60)  =  42.989167°  (positive = North/East)
 *   "73,58.45W"  →  73 + (58.45 / 60)  =  73.974167°  (negative = South/West)
 *
 * Falls back to parseFloat() for plain decimal strings so the block works
 * regardless of how a particular AEM instance stores the metadata.
 */
function parseDMS(value) {
  if (value == null) return NaN;
  const s = String(value).trim();
  const m = s.match(/^(\d+),(\d+\.?\d*)([NSEW])$/i);
  if (!m) return parseFloat(s);
  const decimal = parseFloat(m[1]) + parseFloat(m[2]) / 60;
  return /[SW]/i.test(m[3]) ? -decimal : decimal;
}

/**
 * Parses AEM EXIF altitude values to a plain float (metres).
 * AEM stores GPSAltitude as a rational string ("150/1", "2350/100") or plain decimal.
 * Returns NaN for absent/invalid values so the altitude line is silently omitted.
 */
function parseRational(value) {
  if (value == null) return NaN;
  const s = String(value).trim();
  const slash = s.indexOf('/');
  if (slash !== -1) {
    const num = parseFloat(s.slice(0, slash));
    const den = parseFloat(s.slice(slash + 1));
    return den !== 0 ? num / den : NaN;
  }
  return parseFloat(s);
}

function initMap(container, lat, lon, zoom) {
  /* global L */
  const map = L.map(container, {
    zoomControl: true,
    scrollWheelZoom: false,
  });

  L.tileLayer(OSM_TILES, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  }).addTo(map);

  // Use raw float precision — no rounding
  map.setView([lat, lon], zoom);
  L.marker([lat, lon]).addTo(map);

  // Re-measure when the container becomes visible (e.g. inside a <dialog> modal).
  // ResizeObserver fires on dimension change — covers dialog open, panel resize, etc.
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(container);
}

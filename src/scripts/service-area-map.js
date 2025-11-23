/**
 * Interactive service area map powered by static data generated at build time.
 * The map consumes public/data/service-areas.json, which is derived from the
 * site suburbs list and an external WA suburb GeoJSON dataset. No runtime APIs
 * or paid map services are used.
 */
/* eslint-env browser */

import L from 'leaflet';
const DATA_URL = '/data/service-areas.json';
const DEFAULT_VIEW = { lat: -31.671, lng: 115.708 };
const DEFAULT_ZOOM = 12;
const DEFAULT_RADIUS = 1500;
const METERS_PER_LAT_DEGREE = 111132;
const METERS_PER_LNG_DEGREE_AT_EQUATOR = 111320;
const TILE_ATTRIBUTION = '© OpenStreetMap contributors';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 50;

const POSTCODE_REGIONS = [
  {
    label: 'Perth CBD & northern suburbs',
    min: 6000,
    max: 6110,
    center: { lat: -31.9529, lng: 115.8573 },
    radius: 9000,
    padding: 0.3,
  },
  {
    label: 'Southern Perth corridor',
    min: 6111,
    max: 6200,
    center: { lat: -32.085, lng: 115.917 },
    radius: 14000,
  },
  {
    label: 'Peel & South West coast',
    min: 6201,
    max: 6299,
    center: { lat: -32.742, lng: 115.735 },
    radius: 24000,
  },
  {
    label: 'Great Southern & Wheatbelt',
    min: 6300,
    max: 6399,
    center: { lat: -33.63, lng: 117.35 },
    radius: 40000,
  },
  {
    label: 'Goldfields & Esperance',
    min: 6400,
    max: 6499,
    center: { lat: -30.75, lng: 121.47 },
    radius: 52000,
  },
  {
    label: 'Mid West & Geraldton',
    min: 6500,
    max: 6639,
    center: { lat: -28.778, lng: 114.616 },
    radius: 42000,
  },
  {
    label: 'Gascoyne coast',
    min: 6640,
    max: 6719,
    center: { lat: -24.882, lng: 113.657 },
    radius: 46000,
  },
  {
    label: 'Pilbara',
    min: 6720,
    max: 6759,
    center: { lat: -20.737, lng: 117.156 },
    radius: 52000,
  },
  {
    label: 'Kimberley',
    min: 6760,
    max: 6799,
    center: { lat: -17.961, lng: 122.237 },
    radius: 52000,
  },
  {
    label: 'Perth PO boxes',
    min: 6800,
    max: 6999,
    center: { lat: -31.9529, lng: 115.8573 },
    radius: 10000,
    padding: 0.3,
  },
];

const getPostcodeRegion = (value) => {
  const number = Number.parseInt(String(value ?? '').trim(), 10);
  if (Number.isNaN(number)) return null;
  return (
    POSTCODE_REGIONS.find(
      (region) => number >= region.min && number <= region.max
    ) ?? null
  );
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const metersPerLngDegree = (lat) =>
  Math.max(Math.cos(toRadians(lat)) * METERS_PER_LNG_DEGREE_AT_EQUATOR, 0.0001);

const hashToUnitInterval = (value) => {
  const input = String(value ?? '');
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0; // force 32-bit int
  }
  const normalized = Math.abs(hash % 10000);
  return normalized / 10000;
};

const toFiniteNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const DIRECTIONAL_KEYWORDS = [
  { pattern: /\bnorth(ern)?\b/i, angle: Math.PI / 2 },
  { pattern: /\bsouth(ern)?\b/i, angle: (3 * Math.PI) / 2 },
  { pattern: /\beast(ern)?\b/i, angle: 0 },
  { pattern: /\bwest(ern)?\b/i, angle: Math.PI },
  { pattern: /\bupper\b/i, angle: Math.PI / 2 },
  { pattern: /\blower\b/i, angle: (3 * Math.PI) / 2 },
  { pattern: /\binner\b/i, angle: Math.PI / 2 },
  { pattern: /\bouter\b/i, angle: (3 * Math.PI) / 2 },
];

const getDirectionalBiasAngle = (name) => {
  const matches = DIRECTIONAL_KEYWORDS.filter((entry) =>
    entry.pattern.test(name)
  );
  if (!matches.length) return null;
  const { x, y } = matches.reduce(
    (acc, entry) => ({
      x: acc.x + Math.cos(entry.angle),
      y: acc.y + Math.sin(entry.angle),
    }),
    { x: 0, y: 0 }
  );
  return Math.atan2(y, x);
};

const blendAngles = (primary, fallback, influence = 0.7) => {
  const x =
    Math.cos(primary) * influence + Math.cos(fallback) * (1 - influence);
  const y =
    Math.sin(primary) * influence + Math.sin(fallback) * (1 - influence);
  return Math.atan2(y, x);
};

const zoomFromRadius = (radius) => {
  if (radius <= 900) return 16;
  if (radius <= 1500) return 15;
  if (radius <= 2500) return 14;
  if (radius <= 4000) return 13;
  if (radius <= 6500) return 12;
  if (radius <= 9000) return 11;
  return 10;
};

const mapSuburbToRegionBasedView = (entry, region) => {
  const targetRegion = region ?? {
    center: DEFAULT_VIEW,
    radius: DEFAULT_RADIUS * 2,
    padding: 0.25,
  };
  const baseCenter = {
    lat: toFiniteNumber(targetRegion.center?.lat) ?? DEFAULT_VIEW.lat,
    lng: toFiniteNumber(targetRegion.center?.lng) ?? DEFAULT_VIEW.lng,
  };
  const reach = Math.max(
    toFiniteNumber(targetRegion.radius) ?? DEFAULT_RADIUS,
    3500
  );
  const seedAngle = hashToUnitInterval(`${entry.key}-angle`) * Math.PI * 2;
  const seedDistance = hashToUnitInterval(`${entry.key}-distance`);
  const biasAngle = getDirectionalBiasAngle(entry.displayName ?? '');
  const angle =
    biasAngle === null ? seedAngle : blendAngles(biasAngle, seedAngle, 0.8);
  const distance = clamp(
    reach * (0.25 + seedDistance * 0.45),
    1500,
    reach * 0.85
  );
  const latDelta = (Math.sin(angle) * distance) / METERS_PER_LAT_DEGREE;
  const lngDelta =
    (Math.cos(angle) * distance) / metersPerLngDegree(baseCenter.lat);
  const radius = clamp(distance * 0.35, 800, Math.min(reach * 0.45, 12000));
  return {
    center: {
      lat: baseCenter.lat + latDelta,
      lng: baseCenter.lng + lngDelta,
    },
    radius,
    pad: toFiniteNumber(targetRegion.padding) ?? 0.2,
    zoom: zoomFromRadius(radius),
  };
};

const getSuburbView = (entry, region) => {
  const hasLat = typeof entry.lat === 'number' && Number.isFinite(entry.lat);
  const hasLng = typeof entry.lng === 'number' && Number.isFinite(entry.lng);
  if (hasLat && hasLng) {
    const radius = 2000;
    return {
      center: { lat: entry.lat, lng: entry.lng },
      radius,
      pad: 0.15,
      zoom: zoomFromRadius(radius),
      precise: true,
    };
  }
  return { ...mapSuburbToRegionBasedView(entry, region), precise: false };
};

const toDisplayName = (value) =>
  value
    .toLowerCase()
    .replace(/([\s-/]+)/g, '$1')
    .trim()
    .split(/([\s-/]+)/)
    .map((chunk) =>
      /[a-z]/.test(chunk)
        ? chunk.charAt(0).toUpperCase() + chunk.slice(1)
        : chunk
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const loadSuburbs = (() => {
  let cache = null;
  const fetchRecords = async () => {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error('Failed to load service areas');
      return response.json();
    } catch (error) {
      console.warn('Unable to load service areas dataset', error);
      return [];
    }
  };
  return () => {
    if (!cache) {
      cache = fetchRecords()
        .then((records) =>
          records
            .map((record) => {
              const displayName = toDisplayName(record.suburb ?? '');
              const lat = toFiniteNumber(record.lat);
              const lng = toFiniteNumber(record.lng);
              return {
                ...record,
                lat,
                lng,
                displayName,
                searchValue: displayName.toLowerCase(),
                key: `${record.suburb}-${record.postcode}`,
              };
            })
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
        )
        .catch((error) => {
          console.warn('Unable to load suburb list', error);
          return [];
        });
    }
    return cache;
  };
})();

const filterSuburbs = (list, query) => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];
  if (/^\d+$/.test(trimmed)) {
    return list.filter((item) => item.postcode.startsWith(trimmed));
  }
  return list.filter((item) =>
    item.searchValue.includes(trimmed.toLowerCase())
  );
};

const toLatLngPoint = (lat, lng) => ({
  lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : DEFAULT_VIEW.lat,
  lng: typeof lng === 'number' && Number.isFinite(lng) ? lng : DEFAULT_VIEW.lng,
});

const createMapController = async (canvas) => {
  const map = L.map(canvas, {
    zoomControl: false,
    scrollWheelZoom: true,
    attributionControl: false,
    minZoom: 7,
    maxZoom: 18,
  });
  L.tileLayer(TILE_URL, {
    minZoom: 7,
    maxZoom: 18,
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);
  L.control
    .attribution({ prefix: '' })
    .addAttribution(TILE_ATTRIBUTION)
    .addTo(map);
  let highlightLayer = null;
  const setHighlight = (layer) => {
    if (highlightLayer) {
      map.removeLayer(highlightLayer);
    }
    highlightLayer = layer.addTo(map);
    return highlightLayer;
  };
  const highlightOptions = {
    color: '#89040b',
    weight: 3,
    opacity: 0.9,
    fillColor: '#f36a6f',
    fillOpacity: 0.25,
  };
  const highlightCircle = ({
    center,
    radius = DEFAULT_RADIUS,
    pad = 0.5,
    zoom,
  }) => {
    const layer = L.circle(center, { ...highlightOptions, radius });
    setHighlight(layer);
    if (typeof zoom === 'number') {
      map.setView(center, zoom);
    } else {
      map.fitBounds(layer.getBounds().pad(pad));
    }
  };
  map.setView(
    { lat: DEFAULT_VIEW.lat, lng: DEFAULT_VIEW.lng },
    DEFAULT_ZOOM
  );
  requestAnimationFrame(() => map.invalidateSize());
  return {
    map,
    setView: (lat, lng, zoom = DEFAULT_ZOOM) =>
      map.setView(toLatLngPoint(lat, lng), zoom),
    highlightCircle,
  };
};

const setupWidget = (root) => {
  if (root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';
  const input = root.querySelector('[data-service-area-input]');
  const list = root.querySelector('[data-service-area-results]');
  const empty = root.querySelector('[data-service-area-empty]');
  const status = root.querySelector('[data-service-area-status]');
  const canvas = root.querySelector('[data-service-area-canvas]');
  const loader = root.querySelector('[data-service-area-loader]');
  const zoomIn = root.querySelector('[data-service-area-zoom-in]');
  const zoomOut = root.querySelector('[data-service-area-zoom-out]');
  if (!input || !list || !empty || !status || !canvas) return;
  const state = { suburbs: [], results: [], selectedKey: null };
  const mapPromise = createMapController(canvas)
    .then((controller) => {
      loader?.remove();
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) =>
            controller.setView(
              position.coords.latitude,
              position.coords.longitude,
              DEFAULT_ZOOM
            ),
          () =>
            controller.setView(
              DEFAULT_VIEW.lat,
              DEFAULT_VIEW.lng,
              DEFAULT_ZOOM
            ),
          { enableHighAccuracy: false, timeout: 6000 }
        );
      }
      return controller;
    })
    .catch((error) => {
      console.warn('Map unavailable', error);
      if (loader)
        loader.textContent = 'Map unavailable. Please try again later.';
      return null;
    });

  const bindZoomControl = (button, delta) => {
    if (!button) return;
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const controller = await mapPromise;
      if (!controller) return;
      const mapInstance = controller.map;
      if (!mapInstance || typeof mapInstance.setView !== 'function') return;
      const currentCenter = toLatLngPoint(
        mapInstance._center?.lat,
        mapInstance._center?.lng
      );
      const currentZoom =
        typeof mapInstance._zoom === 'number'
          ? mapInstance._zoom
          : DEFAULT_ZOOM;
      mapInstance.setView(currentCenter, currentZoom + delta);
    });
  };

  bindZoomControl(zoomIn, 1);
  bindZoomControl(zoomOut, -1);

  const render = (items, query) => {
    state.results = items.slice(0, MAX_RESULTS);
    list.innerHTML = '';
    if (state.results.length === 0) {
      empty.hidden = false;
      empty.textContent =
        query.trim().length < MIN_QUERY_LENGTH
          ? 'Enter at least two letters or a postcode to see available suburbs.'
          : 'No suburbs found. Try another suburb or postcode.';
      return;
    }
    empty.hidden = true;
    const fragment = document.createDocumentFragment();
    state.results.forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'service-area-map-widget__result-button';
      button.dataset.key = entry.key;
      button.textContent = `${entry.displayName} (${entry.postcode})`;
      if (entry.key === state.selectedKey) button.classList.add('is-selected');
      button.addEventListener('click', () => select(entry));
      item.appendChild(button);
      fragment.appendChild(item);
    });
    list.appendChild(fragment);
  };

  const select = async (entry) => {
    state.selectedKey = entry.key;
    const region = getPostcodeRegion(entry.postcode);
    const hasPreciseCoords =
      typeof entry.lat === 'number' &&
      Number.isFinite(entry.lat) &&
      typeof entry.lng === 'number' &&
      Number.isFinite(entry.lng);
    if (!region && !hasPreciseCoords) {
      status.textContent = `We couldn't determine a map location for ${entry.displayName} (${entry.postcode}).`;
      return;
    }
    status.textContent = `Locating ${entry.displayName} (${entry.postcode})...`;
    render(state.results, input.value);
    const mapController = await mapPromise;
    if (!mapController) {
      status.textContent = `${entry.displayName} located, but the map failed to load.`;
      return;
    }
    const focus = getSuburbView(entry, region);
    if (
      !focus?.center ||
      !Number.isFinite(focus.center.lat) ||
      !Number.isFinite(focus.center.lng)
    ) {
      status.textContent = `${entry.displayName} (${entry.postcode}) is missing map coordinates.`;
      return;
    }
    mapController.highlightCircle(focus);
    if (focus.precise) {
      status.textContent = `${entry.displayName} (${entry.postcode}) highlighted with a suburb-level view.`;
      return;
    }
    const suffix = region?.label ? ` in the ${region.label} area` : '';
    status.textContent = `${entry.displayName} (${entry.postcode}) highlighted${suffix}.`;
  };

  input.addEventListener('input', () => {
    render(filterSuburbs(state.suburbs, input.value), input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && state.results.length > 0) {
      event.preventDefault();
      select(state.results[0]);
    }
  });

  loadSuburbs().then((suburbs) => {
    state.suburbs = suburbs;
    if (!suburbs.length) {
      empty.hidden = false;
      empty.textContent = 'Suburb list unavailable. Please try again later.';
      return;
    }
    if (input.value.trim().length >= MIN_QUERY_LENGTH) {
      render(filterSuburbs(state.suburbs, input.value), input.value);
    }
  });
};

const initServiceAreaMaps = () => {
  document
    .querySelectorAll('[data-service-area-root]')
    .forEach((root) => setupWidget(root));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initServiceAreaMaps, {
    once: true,
  });
} else {
  initServiceAreaMaps();
}

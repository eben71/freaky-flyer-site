/* eslint-env browser */
/* global URLSearchParams */

const DATA_URL = '/data/suburbs.json';
const DEFAULT_VIEW = { lat: -31.7694219, lng: 115.8273151 };
const DEFAULT_ZOOM = 11;
const DEFAULT_RADIUS = 1500;
const TILE_ATTRIBUTION = '© OpenStreetMap contributors';
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 50;

const ensureLeafletStyles = () => {
  if (document.getElementById('leaflet-cdn')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-cdn';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  document.head.appendChild(link);
};

const loadLeaflet = (() => {
  let cache = null;
  return async () => {
    if (!cache) {
      ensureLeafletStyles();
      cache = import('https://esm.sh/leaflet@1.9.4?bundle').then((mod) => {
        const leaflet = mod?.default ?? mod;
        if (!leaflet || typeof leaflet.map !== 'function') {
          throw new Error('Leaflet failed to load');
        }
        return leaflet;
      });
    }
    return cache;
  };
})();

const toDisplayName = (value) =>
  value
    .toLowerCase()
    .replace(/([\s-/]+)/g, '$1')
    .trim()
    .split(/([\s-/]+)/)
    .map((chunk) => (/[a-z]/.test(chunk) ? chunk.charAt(0).toUpperCase() + chunk.slice(1) : chunk))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

const loadSuburbs = (() => {
  let cache = null;
  return () => {
    if (!cache) {
      cache = fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load suburbs');
          return res.json();
        })
        .then((records) =>
          records
            .map((record) => {
              const displayName = toDisplayName(record.suburb ?? '');
              return {
                ...record,
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
  return list.filter((item) => item.searchValue.includes(trimmed.toLowerCase()));
};

const geocodeCache = new Map();
const geocode = async (entry) => {
  if (geocodeCache.has(entry.key)) return geocodeCache.get(entry.key);
  const params = new URLSearchParams({
    format: 'jsonv2',
    polygon_geojson: '1',
    addressdetails: '0',
    limit: '1',
    countrycodes: 'au',
    state: 'Western Australia',
    q: `${entry.displayName}, Western Australia ${entry.postcode}, Australia`,
    email: 'hello@freakyflyerdelivery.com.au',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Lookup failed');
    const data = await res.json();
    const first = data?.[0];
    if (!first) return null;
    const value = {
      lat: Number.parseFloat(first.lat),
      lng: Number.parseFloat(first.lon),
      geojson: first.geojson,
    };
    geocodeCache.set(entry.key, value);
    return value;
  } catch (error) {
    console.warn('Unable to geocode suburb', entry.suburb, error);
    return null;
  }
};

const parsePolygon = (geometry) => {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return null;
};

const createMapController = async (canvas) => {
  const L = await loadLeaflet();
  const map = L.map(canvas, {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: false,
  });
  L.tileLayer(TILE_URL, {
    minZoom: 7,
    maxZoom: 18,
    attribution: TILE_ATTRIBUTION,
  }).addTo(map);
  L.control.attribution({ prefix: '' }).addAttribution(TILE_ATTRIBUTION).addTo(map);
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
  const highlightPolygon = (rings) => {
    if (!Array.isArray(rings) || !rings.length) return;
    const latLngs = rings.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
    const layer = L.polygon(latLngs, highlightOptions);
    setHighlight(layer);
    map.fitBounds(layer.getBounds().pad(0.15));
  };
  const highlightCircle = (center, radius = DEFAULT_RADIUS) => {
    const layer = L.circle(center, { ...highlightOptions, radius });
    setHighlight(layer);
    map.fitBounds(layer.getBounds().pad(0.5));
  };
  map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_ZOOM);
  requestAnimationFrame(() => map.invalidateSize());
  return {
    map,
    setView: (lat, lng, zoom = DEFAULT_ZOOM) => map.setView([lat, lng], zoom),
    highlightPolygon,
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
  if (!input || !list || !empty || !status || !canvas) return;
  const state = { suburbs: [], results: [], selectedKey: null };
  const mapPromise = createMapController(canvas)
    .then((controller) => {
      loader?.remove();
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => controller.setView(position.coords.latitude, position.coords.longitude, 12),
          () => controller.setView(DEFAULT_VIEW.lat, DEFAULT_VIEW.lng, DEFAULT_ZOOM),
          { enableHighAccuracy: false, timeout: 6000 }
        );
      }
      return controller;
    })
    .catch((error) => {
      console.warn('Map unavailable', error);
      if (loader) loader.textContent = 'Map unavailable. Please try again later.';
      return null;
    });

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
    status.textContent = `Locating ${entry.displayName} (${entry.postcode})...`;
    render(state.results, input.value);
    const mapController = await mapPromise;
    const result = await geocode(entry);
    if (!result) {
      status.textContent = `Unable to locate ${entry.displayName}. Please try another suburb.`;
      return;
    }
    if (!mapController) {
      status.textContent = `${entry.displayName} located, but the map failed to load.`;
      return;
    }
    const poly = parsePolygon(result.geojson);
    if (poly?.length) {
      mapController.highlightPolygon(poly);
    } else {
      mapController.highlightCircle([result.lat, result.lng], DEFAULT_RADIUS);
    }
    status.textContent = `${entry.displayName} (${entry.postcode}) highlighted on the map.`;
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
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-service-area-root]').forEach((root) => setupWidget(root));
});

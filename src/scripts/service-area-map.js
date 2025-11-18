/* eslint-env browser */

const DATA_URL = '/data/suburbs.json';
const DEFAULT_VIEW = { lat: -31.7694219, lng: 115.8273151 };
const DEFAULT_ZOOM = 11;
const DEFAULT_RADIUS = 1500;
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
    radius: 12000,
    padding: 0.3,
  },
  {
    label: 'Southern Perth corridor',
    min: 6111,
    max: 6200,
    center: { lat: -32.085, lng: 115.917 },
    radius: 18000,
  },
  {
    label: 'Peel & South West coast',
    min: 6201,
    max: 6299,
    center: { lat: -32.742, lng: 115.735 },
    radius: 35000,
  },
  {
    label: 'Great Southern & Wheatbelt',
    min: 6300,
    max: 6399,
    center: { lat: -33.63, lng: 117.35 },
    radius: 60000,
  },
  {
    label: 'Goldfields & Esperance',
    min: 6400,
    max: 6499,
    center: { lat: -30.75, lng: 121.47 },
    radius: 80000,
  },
  {
    label: 'Mid West & Geraldton',
    min: 6500,
    max: 6639,
    center: { lat: -28.778, lng: 114.616 },
    radius: 65000,
  },
  {
    label: 'Gascoyne coast',
    min: 6640,
    max: 6719,
    center: { lat: -24.882, lng: 113.657 },
    radius: 80000,
  },
  {
    label: 'Pilbara',
    min: 6720,
    max: 6759,
    center: { lat: -20.737, lng: 117.156 },
    radius: 90000,
  },
  {
    label: 'Kimberley',
    min: 6760,
    max: 6799,
    center: { lat: -17.961, lng: 122.237 },
    radius: 100000,
  },
  {
    label: 'Perth PO boxes',
    min: 6800,
    max: 6999,
    center: { lat: -31.9529, lng: 115.8573 },
    radius: 12000,
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

const ensureLeafletScript = () => {
  const existing = document.getElementById('leaflet-cdn-script');
  if (existing) return existing;
  const script = document.createElement('script');
  script.id = 'leaflet-cdn-script';
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  script.crossOrigin = '';
  document.head.appendChild(script);
  return script;
};

const isLeafletReady = () =>
  typeof window !== 'undefined' &&
  window.L &&
  typeof window.L.map === 'function';

const loadLeaflet = (() => {
  let cache = null;
  return () => {
    if (isLeafletReady()) {
      return Promise.resolve(window.L);
    }
    if (!cache) {
      ensureLeafletStyles();
      cache = new Promise((resolve, reject) => {
        const script = ensureLeafletScript();
        const handleLoad = () => {
          script.dataset.ready = 'true';
          if (isLeafletReady()) {
            resolve(window.L);
          } else {
            cache = null;
            reject(new Error('Leaflet loaded without exposing the map API.'));
          }
        };
        const handleError = (event) => {
          script.removeEventListener('load', handleLoad);
          cache = null;
          const ErrorEventCtor =
            typeof window !== 'undefined' ? window.ErrorEvent : undefined;
          const errorEventSupported =
            typeof ErrorEventCtor === 'function' &&
            event instanceof ErrorEventCtor;
          reject(
            errorEventSupported && event.error
              ? event.error
              : new Error('Leaflet failed to load')
          );
        };
        if (script.dataset.ready === 'true') {
          handleLoad();
          return;
        }
        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });
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
  return list.filter((item) =>
    item.searchValue.includes(trimmed.toLowerCase())
  );
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
  const highlightCircle = (center, radius = DEFAULT_RADIUS, pad = 0.5) => {
    const layer = L.circle(center, { ...highlightOptions, radius });
    setHighlight(layer);
    map.fitBounds(layer.getBounds().pad(pad));
  };
  map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_ZOOM);
  requestAnimationFrame(() => map.invalidateSize());
  return {
    map,
    setView: (lat, lng, zoom = DEFAULT_ZOOM) => map.setView([lat, lng], zoom),
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
          (position) =>
            controller.setView(
              position.coords.latitude,
              position.coords.longitude,
              12
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
    if (!region) {
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
    mapController.highlightCircle(
      [region.center.lat, region.center.lng],
      region.radius ?? DEFAULT_RADIUS,
      region.padding ?? 0.5
    );
    const suffix = region.label ? ` in the ${region.label} area` : '';
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

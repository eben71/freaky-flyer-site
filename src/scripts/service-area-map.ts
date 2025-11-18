const DATA_URL = '/data/suburbs.json';
const DEFAULT_VIEW = { lat: -31.7694219, lng: 115.8273151 };
const DEFAULT_RADIUS = 1500;
const TILE = 256;
const DEG = Math.PI / 180;
const MIN_ZOOM = 7;
const MAX_ZOOM = 16;
const MAX_RESULTS = 50;

type SuburbRecord = { suburb: string; postcode: string };
type SuburbEntry = SuburbRecord & { displayName: string; searchValue: string; key: string };
type GeocodeResult = { lat: number; lng: number; geojson?: { type: string; coordinates: any } };
type WidgetState = { suburbs: SuburbEntry[]; results: SuburbEntry[]; selectedKey: string | null };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const wrapLng = (lng: number) => (lng > 180 ? lng - 360 : lng < -180 ? lng + 360 : lng);
const project = (lat: number, lng: number) => {
  const sin = Math.sin(clamp(lat, -85, 85) * DEG);
  return { x: (wrapLng(lng) + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
};
const unproject = (x: number, y: number) => {
  const n = Math.PI - 2 * Math.PI * y;
  return {
    lat: clamp((180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), -85, 85),
    lng: wrapLng(x * 360 - 180),
  };
};
const metersPerPixel = (lat: number, zoom: number) => (156543.03392 * Math.cos(lat * DEG)) / 2 ** zoom;

class MapView {
  private el: HTMLElement;
  private tiles: HTMLDivElement;
  private overlay: SVGSVGElement;
  private path: SVGPathElement;
  private center = { ...DEFAULT_VIEW };
  private zoom = 11;
  private highlight: { type: 'polygon'; rings: [number, number][][] } | { type: 'circle'; center: [number, number]; radius: number } | null = null;
  private viewport: { originX: number; originY: number; scale: number; width: number; height: number } | null = null;

  constructor(target: HTMLElement) {
    this.el = target;
    this.tiles = document.createElement('div');
    this.tiles.className = 'service-area-map-widget__tiles';
    this.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.overlay.classList.add('service-area-map-widget__overlay');
    this.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.path.setAttribute('fill', 'rgba(137, 4, 11, 0.25)');
    this.path.setAttribute('stroke', 'rgba(137, 4, 11, 0.9)');
    this.path.setAttribute('stroke-width', '3');
    this.overlay.appendChild(this.path);
    this.el.append(this.tiles, this.overlay);
    this.attachEvents();
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => this.render()).observe(this.el);
    }
    this.render();
  }

  setView(lat: number, lng: number, zoom = this.zoom) {
    this.center = { lat: clamp(lat, -85, 85), lng: wrapLng(lng) };
    this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.render();
  }

  fitBounds(bounds: { south: number; west: number; north: number; east: number }) {
    const rect = this.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sw = project(bounds.south, bounds.west);
    const ne = project(bounds.north, bounds.east);
    let best = MAX_ZOOM;
    for (let z = MAX_ZOOM; z >= MIN_ZOOM; z -= 1) {
      const scale = TILE * 2 ** z;
      if (
        Math.abs(ne.x - sw.x) * scale <= rect.width - 48 &&
        Math.abs(sw.y - ne.y) * scale <= rect.height - 48
      ) {
        best = z;
        break;
      }
    }
    const center = unproject((sw.x + ne.x) / 2, (sw.y + ne.y) / 2);
    this.setView(center.lat, center.lng, best);
  }

  showPolygon(rings: [number, number][][], fit = true) {
    this.highlight = { type: 'polygon', rings };
    if (fit) {
      const bounds = rings.reduce(
        (acc, ring) => {
          ring.forEach(([lng, lat]) => {
            acc.south = Math.min(acc.south, lat);
            acc.north = Math.max(acc.north, lat);
            acc.west = Math.min(acc.west, lng);
            acc.east = Math.max(acc.east, lng);
          });
          return acc;
        },
        { south: 90, north: -90, west: 180, east: -180 }
      );
      this.fitBounds(bounds);
    } else {
      this.drawHighlight();
    }
  }

  showCircle(center: [number, number], radius: number, fit = true) {
    this.highlight = { type: 'circle', center, radius };
    if (fit) {
      const [lat, lng] = center;
      const latOffset = (radius / 111320) * 1.2;
      const lngOffset = (radius / (111320 * Math.cos(lat * DEG))) * 1.2;
      this.fitBounds({
        south: lat - latOffset,
        north: lat + latOffset,
        west: lng - lngOffset,
        east: lng + lngOffset,
      });
    } else {
      this.drawHighlight();
    }
  }

  private attachEvents() {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    this.el.addEventListener('pointerdown', (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      this.el.setPointerCapture(event.pointerId);
    });
    const stop = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        this.el.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore release errors
      }
    };
    this.el.addEventListener('pointerup', stop);
    this.el.addEventListener('pointercancel', stop);
    this.el.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      this.pan(event.clientX - lastX, event.clientY - lastY);
      lastX = event.clientX;
      lastY = event.clientY;
    });
    this.el.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const next = clamp(this.zoom + (event.deltaY > 0 ? -1 : 1), MIN_ZOOM, MAX_ZOOM);
        if (next !== this.zoom) {
          this.zoom = next;
          this.render();
        }
      },
      { passive: false }
    );
  }

  private pan(dx: number, dy: number) {
    if (!this.viewport) return;
    const world = project(this.center.lat, this.center.lng);
    const scale = this.viewport.scale;
    this.center = unproject(world.x - dx / scale, world.y - dy / scale);
    this.render();
  }

  private render() {
    const rect = this.el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = TILE * 2 ** this.zoom;
    const world = project(this.center.lat, this.center.lng);
    const centerPx = { x: world.x * scale, y: world.y * scale };
    this.viewport = {
      originX: centerPx.x - rect.width / 2,
      originY: centerPx.y - rect.height / 2,
      scale,
      width: rect.width,
      height: rect.height,
    };
    this.renderTiles();
    this.drawHighlight();
  }

  private renderTiles() {
    if (!this.viewport) return;
    const { originX, originY, width, height } = this.viewport;
    const startX = Math.floor(originX / TILE) - 1;
    const endX = Math.floor((originX + width) / TILE) + 1;
    const startY = Math.floor(originY / TILE) - 1;
    const endY = Math.floor((originY + height) / TILE) + 1;
    const tileCount = 1 << this.zoom;
    this.tiles.innerHTML = '';
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        if (y < 0 || y >= tileCount) continue;
        const wrapped = ((x % tileCount) + tileCount) % tileCount;
        const img = document.createElement('img');
        img.className = 'service-area-map-widget__tile';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = `https://tile.openstreetmap.org/${this.zoom}/${wrapped}/${y}.png`;
        img.style.left = `${Math.round(x * TILE - originX)}px`;
        img.style.top = `${Math.round(y * TILE - originY)}px`;
        this.tiles.appendChild(img);
      }
    }
  }

  private drawHighlight() {
    if (!this.viewport || !this.highlight) {
      this.path.setAttribute('d', '');
      return;
    }
    const { width, height } = this.viewport;
    this.overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.overlay.setAttribute('width', `${width}`);
    this.overlay.setAttribute('height', `${height}`);
    if (this.highlight.type === 'polygon') {
      const d = this.highlight.rings
        .map((ring) =>
          ring
            .map(([lng, lat], index) => {
              const point = this.point(lat, lng);
              return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
            })
            .concat('Z')
            .join(' ')
        )
        .join(' ');
      this.path.setAttribute('d', d);
    } else {
      const [lat, lng] = this.highlight.center;
      const radius = Math.max(this.highlight.radius / metersPerPixel(lat, this.zoom), 1);
      const { x, y } = this.point(lat, lng);
      const d = `M ${x - radius},${y} a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
      this.path.setAttribute('d', d);
    }
  }

  private point(lat: number, lng: number) {
    if (!this.viewport) return { x: 0, y: 0 };
    const { originX, originY, scale } = this.viewport;
    const world = project(lat, lng);
    return { x: world.x * scale - originX, y: world.y * scale - originY };
  }
}

const loadSuburbs = (() => {
  let cache: Promise<SuburbEntry[]> | null = null;
  return () => {
    if (!cache) {
      cache = fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load suburbs');
          return res.json() as Promise<SuburbRecord[]>;
        })
        .then((records) =>
          records
            .map((record) => {
              const name = record.suburb?.toLowerCase().replace(/([\s-/]+)/g, '$1').trim() || '';
              const display = name
                .split(/([\s-/]+)/)
                .map((chunk) => (/[a-z]/.test(chunk) ? chunk.charAt(0).toUpperCase() + chunk.slice(1) : chunk))
                .join('')
                .replace(/\s+/g, ' ')
                .trim();
              return {
                ...record,
                displayName: display,
                searchValue: display.toLowerCase(),
                key: `${record.suburb}-${record.postcode}`,
              } as SuburbEntry;
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

const filterSuburbs = (list: SuburbEntry[], query: string) => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return /^\d+$/.test(trimmed)
    ? list.filter((item) => item.postcode.startsWith(trimmed))
    : list.filter((item) => item.searchValue.includes(trimmed.toLowerCase()));
};

const geocodeCache = new Map<string, GeocodeResult>();
const geocode = async (entry: SuburbEntry) => {
  if (geocodeCache.has(entry.key)) return geocodeCache.get(entry.key) ?? null;
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
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      geojson?: { type: string; coordinates: any };
    }>;
    const first = data[0];
    if (!first) return null;
    const value: GeocodeResult = {
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

const parsePolygon = (geometry?: { type: string; coordinates: any }) => {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return geometry.coordinates as [number, number][][];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat() as [number, number][][];
  return null;
};

const setupWidget = (root: HTMLElement) => {
  if (root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';
  const input = root.querySelector<HTMLInputElement>('[data-service-area-input]');
  const list = root.querySelector<HTMLUListElement>('[data-service-area-results]');
  const empty = root.querySelector<HTMLElement>('[data-service-area-empty]');
  const status = root.querySelector<HTMLElement>('[data-service-area-status]');
  const canvas = root.querySelector<HTMLElement>('[data-service-area-canvas]');
  const loader = root.querySelector<HTMLElement>('[data-service-area-loader]');
  if (!input || !list || !empty || !status || !canvas) return;
  const map = new MapView(canvas);
  map.setView(DEFAULT_VIEW.lat, DEFAULT_VIEW.lng, 11);
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => map.setView(position.coords.latitude, position.coords.longitude, 12),
      () => map.setView(DEFAULT_VIEW.lat, DEFAULT_VIEW.lng, 11),
      { enableHighAccuracy: false, timeout: 6000 }
    );
  }
  loader?.remove();
  const state: WidgetState = { suburbs: [], results: [], selectedKey: null };
  const render = (items: SuburbEntry[], query: string) => {
    state.results = items.slice(0, MAX_RESULTS);
    list.innerHTML = '';
    if (state.results.length === 0) {
      empty.hidden = false;
      empty.textContent =
        query.trim().length < 2
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
  const select = async (entry: SuburbEntry) => {
    state.selectedKey = entry.key;
    status.textContent = `Locating ${entry.displayName} (${entry.postcode})...`;
    render(state.results, input.value);
    const result = await geocode(entry);
    if (!result) {
      status.textContent = `Unable to locate ${entry.displayName}. Please try another suburb.`;
      return;
    }
    const poly = parsePolygon(result.geojson);
    if (poly && poly.length > 0) {
      map.showPolygon(poly, true);
    } else {
      map.showCircle([result.lat, result.lng], DEFAULT_RADIUS, true);
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
  document
    .querySelectorAll<HTMLElement>('[data-service-area-root]')
    .forEach((root) => setupWidget(root));
});

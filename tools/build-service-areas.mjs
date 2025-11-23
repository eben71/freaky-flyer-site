import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUBURBS_PATH = new URL(
  './geo/current-suburbs-2025.json',
  import.meta.url
);
const OUTPUT_PATH = new URL(
  '../public/data/service-areas.json',
  import.meta.url
);
const UNMATCHED_OUTPUT_PATH = new URL(
  '../public/geo/unmatched-areas.json',
  import.meta.url
);
const GEO_PRIMARY = new URL('./geo/wa-suburbs.geojson', import.meta.url);
const GEO_FALLBACK = new URL(
  './geo/wa-suburbs.sample.geojson',
  import.meta.url
);

const NAME_KEYS = [
  'LOCALITY_NAME',
  'SSC_NAME',
  'NAME',
  'name',
  'SUBURB',
  'Locality',
  'locality',
];
const POSTCODE_KEYS = [
  'POSTCODE',
  'postcode',
  'POA_CODE',
  'POA_NAME',
  'POA_CODE21',
];
const LGA_KEYS = ['LGA_NAME', 'LGA_NAME21', 'LGA', 'LOCAL_GOVERNMENT_AREA'];

const fileExists = async (url) => {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));

const ensureDir = async (url) =>
  mkdir(dirname(fileURLToPath(url)), { recursive: true });

const normalizeName = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

const stripDecorators = (value) =>
  normalizeName(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(NORTH|SOUTH|EAST|WEST)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parsePostcode = (value) => {
  const match = String(value ?? '').match(/\d{4}/);
  return match ? match[0] : null;
};

const getPropValue = (props, keys) => {
  for (const key of keys) {
    const raw = props?.[key];
    if (raw === undefined || raw === null) continue;
    const text = String(raw).trim();
    if (text) return text;
  }
  return null;
};

const closeRing = (coords = []) => {
  if (coords.length === 0) return coords;
  const [firstLng, firstLat] = coords[0];
  const [lastLng, lastLat] = coords[coords.length - 1] ?? [];
  if (firstLng === lastLng && firstLat === lastLat) return coords;
  return [...coords, coords[0]];
};

const polygonCentroid = (ring) => {
  if (!Array.isArray(ring) || ring.length < 4) return null;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    twiceArea += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  if (twiceArea === 0) return null;
  const area = twiceArea / 2;
  return { lng: cx / (6 * area), lat: cy / (6 * area), area: Math.abs(area) };
};

const computeCentroid = (geometry) => {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    const [outer] = geometry.coordinates ?? [];
    const ring = closeRing(outer ?? []);
    const centroid = polygonCentroid(ring);
    return centroid ? { lat: centroid.lat, lng: centroid.lng } : null;
  }
  if (geometry.type === 'MultiPolygon') {
    let totalArea = 0;
    let weighted = { x: 0, y: 0 };
    for (const polygon of geometry.coordinates ?? []) {
      const [outer] = polygon ?? [];
      const ring = closeRing(outer ?? []);
      const centroid = polygonCentroid(ring);
      if (centroid) {
        totalArea += centroid.area;
        weighted.x += centroid.lng * centroid.area;
        weighted.y += centroid.lat * centroid.area;
      }
    }
    if (!totalArea) return null;
    return { lat: weighted.y / totalArea, lng: weighted.x / totalArea };
  }
  return null;
};

const toFeatureMeta = (feature) => {
  const props = feature?.properties ?? {};
  const nameRaw = getPropValue(props, NAME_KEYS);
  if (!nameRaw) return null;
  const centroid = computeCentroid(feature.geometry);
  if (!centroid) return null;
  return {
    normalizedName: normalizeName(nameRaw),
    simplifiedName: stripDecorators(nameRaw),
    postcode: parsePostcode(getPropValue(props, POSTCODE_KEYS)),
    lga: getPropValue(props, LGA_KEYS),
    lat: centroid.lat,
    lng: centroid.lng,
  };
};

const addToIndex = (map, key, value) => {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
};

const buildFeatureIndex = (features) => {
  const byName = new Map();
  const bySimple = new Map();
  const list = [];
  features.forEach((feature) => {
    const meta = toFeatureMeta(feature);
    if (!meta) return;
    list.push(meta);
    addToIndex(byName, meta.normalizedName, meta);
    addToIndex(bySimple, meta.simplifiedName, meta);
  });
  return { list, byName, bySimple };
};

const unique = (items) => {
  const set = new Set();
  const result = [];
  items.forEach((item) => {
    if (!item || set.has(item)) return;
    set.add(item);
    result.push(item);
  });
  return result;
};

const pickFeature = (candidates, postcode) => {
  if (!candidates.length) return null;
  if (postcode) {
    const match = candidates.find(
      (candidate) => candidate.postcode === postcode
    );
    if (match) return match;
  }
  return candidates[0] ?? null;
};

const matchFeature = (record, index) => {
  const normalizedName = normalizeName(record.suburb);
  const simplifiedName = stripDecorators(record.suburb);
  const postcode = parsePostcode(record.postcode);
  const candidates = unique([
    ...(index.byName.get(normalizedName) ?? []),
    ...(index.bySimple.get(simplifiedName) ?? []),
  ]);
  return pickFeature(candidates, postcode);
};

const logSummary = (matched, total) => {
  const unmatched = total - matched;
  const percent = total > 0 ? (matched / total) * 100 : 0;
  // eslint-disable-next-line no-console
  console.log(
    `Matched ${matched} of ${total} suburbs (${percent.toFixed(1)}%).`
  );
  const unmatchedPercent = total > 0 ? (unmatched / total) * 100 : 0;
  if (unmatchedPercent > 10) {
    // eslint-disable-next-line no-console
    console.warn(
      `Warning: ${unmatched} suburbs (${unmatchedPercent.toFixed(
        1
      )}%) did not match the GeoJSON dataset. Consider updating the source data.`
    );
  }
};

const run = async () => {
  const geoPath = (await fileExists(GEO_PRIMARY)) ? GEO_PRIMARY : GEO_FALLBACK;
  const [suburbs, geojson] = await Promise.all([
    readJson(SUBURBS_PATH),
    readJson(geoPath),
  ]);
  const index = buildFeatureIndex(geojson.features ?? []);
  let matchedCount = 0;
  const unmatched = [];
  const serviceAreas = suburbs.map((record) => {
    const match = matchFeature(record, index);
    if (match) {
      matchedCount += 1;
    } else {
      unmatched.push({
        suburb: String(record.suburb ?? '').trim(),
        normalizedSuburb: normalizeName(record.suburb),
        postcode: String(record.postcode ?? '').trim(),
      });
    }
    const entry = {
      suburb: normalizeName(record.suburb),
      postcode: String(record.postcode ?? '').trim(),
      lat: match?.lat ?? null,
      lng: match?.lng ?? null,
    };
    if (match?.lga) entry.lga = match.lga;
    return entry;
  });
  await ensureDir(UNMATCHED_OUTPUT_PATH);
  await writeFile(OUTPUT_PATH, `${JSON.stringify(serviceAreas)}\n`);
  await writeFile(UNMATCHED_OUTPUT_PATH, `${JSON.stringify(unmatched)}\n`);
  logSummary(matchedCount, serviceAreas.length);
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Unable to build service areas dataset', error);
  process.exitCode = 1;
});

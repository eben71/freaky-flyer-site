const rawBase = (import.meta.env.BASE_URL || '').replace(/\/+$/, '');
export const basePath = rawBase === '/' ? '' : rawBase;

const isExternal = (value: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(value) ||
  value.startsWith('//') ||
  value.startsWith('#') ||
  value.startsWith('mailto:') ||
  value.startsWith('tel:');

export const withBase = (path = '/') => {
  if (!path) return basePath || '/';
  if (isExternal(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (basePath && normalized.startsWith(`${basePath}/`)) {
    return normalized;
  }
  return `${basePath}${normalized}` || '/';
};

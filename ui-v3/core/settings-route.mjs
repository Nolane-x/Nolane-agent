function categoryIds(categories = []) {
  return new Set((Array.isArray(categories) ? categories : []).map((category) => String(category?.id ?? '').trim()).filter(Boolean));
}

export function settingsSectionFromRoute(path, { categories = [] } = {}) {
  const route = new URL(String(path ?? '/settings'), 'http://nolane.local');
  if (route.pathname !== '/settings') return null;
  const section = String(route.searchParams.get('section') ?? '').trim();
  return categoryIds(categories).has(section) ? section : null;
}

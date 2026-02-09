const MAX_RECENT = 10;
const STORAGE_KEY = "attestforme-recent-searches";

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(handle: string) {
  const clean = handle.startsWith("@") ? handle.slice(1) : handle;
  if (!clean) {
    return;
  }
  const recent = getRecentSearches().filter((h) => h !== clean);
  recent.unshift(clean);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT)),
  );
}

export function clearRecentSearches() {
  localStorage.removeItem(STORAGE_KEY);
}

export function removeRecentSearch(handle: string) {
  const recent = getRecentSearches().filter((h) => h !== handle);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

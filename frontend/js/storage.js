const FAVORITES_KEY = "gog-browser-favorites";
const FAILED_LINKS_KEY = "gog-browser-failed-links";
const SYNC_META_KEY = "gog-browser-sync-meta";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function touchSyncMeta() {
  writeJson(SYNC_META_KEY, { updatedAt: new Date().toISOString() });
}

let remoteSyncCallback = null;
let suppressCloudPush = false;

export function setRemoteSyncCallback(fn) {
  remoteSyncCallback = fn;
}

function notifyLocalChange() {
  touchSyncMeta();
  if (!suppressCloudPush && remoteSyncCallback) remoteSyncCallback();
}

export function applyRemoteUserData(payload) {
  if (!payload || payload.version !== 1) return;

  suppressCloudPush = true;
  writeJson(FAVORITES_KEY, payload.favorites || []);
  writeJson(FAILED_LINKS_KEY, payload.failedLinks || []);
  touchSyncMeta();
  suppressCloudPush = false;
}

export function getSyncMeta() {
  return readJson(SYNC_META_KEY, { updatedAt: null });
}

export function exportUserData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: [...getFavorites()],
    failedLinks: [...getFailedLinks()],
  };
}

export function importUserData(payload, { merge = true } = {}) {
  if (!payload || payload.version !== 1) {
    throw new Error("Invalid backup file.");
  }

  const favorites = merge
    ? new Set([...getFavorites(), ...(payload.favorites || [])])
    : new Set(payload.favorites || []);

  const failedLinks = merge
    ? new Set([...getFailedLinks(), ...(payload.failedLinks || [])])
    : new Set(payload.failedLinks || []);

  writeJson(FAVORITES_KEY, [...favorites]);
  writeJson(FAILED_LINKS_KEY, [...failedLinks]);
  notifyLocalChange();

  return {
    favorites: favorites.size,
    failedLinks: failedLinks.size,
  };
}

export function encodeSyncCode() {
  const json = JSON.stringify(exportUserData());
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSyncCode(code) {
  const trimmed = code.trim();
  if (!trimmed) throw new Error("Sync code is empty.");

  try {
    const json = decodeURIComponent(escape(atob(trimmed)));
    return JSON.parse(json);
  } catch {
    throw new Error("Invalid sync code.");
  }
}

export function getFavorites() {
  return new Set(readJson(FAVORITES_KEY, []));
}

export function isFavorite(slug) {
  return getFavorites().has(slug);
}

export function toggleFavorite(slug) {
  const favorites = getFavorites();
  if (favorites.has(slug)) favorites.delete(slug);
  else favorites.add(slug);
  writeJson(FAVORITES_KEY, [...favorites]);
  notifyLocalChange();
  return favorites.has(slug);
}

export function getFailedLinks() {
  return new Set(readJson(FAILED_LINKS_KEY, []));
}

export function getLinkId(slug, category, hostId, url) {
  return `${slug}::${category}::${hostId}::${url}`;
}

export function isLinkFailed(linkId) {
  return getFailedLinks().has(linkId);
}

export function toggleFailedLink(linkId) {
  const failed = getFailedLinks();
  if (failed.has(linkId)) failed.delete(linkId);
  else failed.add(linkId);
  writeJson(FAILED_LINKS_KEY, [...failed]);
  notifyLocalChange();
  return failed.has(linkId);
}

export function countFailedLinksForGame(game) {
  const failed = getFailedLinks();
  let count = 0;

  for (const [category, hosts] of Object.entries(game.download_links || {})) {
    for (const host of Object.values(hosts)) {
      for (const item of host.links || []) {
        if (failed.has(getLinkId(game.slug, category, host.id, item.link))) count++;
      }
    }
  }

  return count;
}

export function getGameLinkStatus(game) {
  const failedCount = countFailedLinksForGame(game);
  if (failedCount > 0) return "failed";
  return "ok";
}

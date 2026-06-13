import { escapeHtml, escapeAttr, debounce, getInitials, renderStars, countDownloadLinks, searchGames } from "./utils.js";
import {
  isFavorite,
  toggleFavorite,
  getFavorites,
  isLinkFailed,
  toggleFailedLink,
  getLinkId,
  countFailedLinksForGame,
  getGameLinkStatus,
  exportUserData,
  importUserData,
  encodeSyncCode,
  decodeSyncCode,
  getSyncMeta,
  getFailedLinks,
  setRemoteSyncCallback,
} from "./storage.js";
import {
  initCloudSync,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  notifyCloudPush,
  resetFirebaseSession,
} from "./cloud-sync.js";
import {
  isCloudSyncConfigured,
  parseFirebaseConfigInput,
  saveFirebaseConfig,
} from "./firebase-config.js";

const PAGE_SIZE = 48;
const DATA_URL = "data/games.json";

const state = {
  allGames: [],
  filteredGames: [],
  currentPage: 1,
  selectedGame: null,
  view: "all",
};

const els = {
  grid: document.getElementById("grid"),
  search: document.getElementById("search"),
  stats: document.getElementById("stats"),
  pagination: document.getElementById("pagination"),
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modal-content"),
  nav: document.getElementById("view-nav"),
  favoritesCount: document.getElementById("favorites-count"),
  syncModal: document.getElementById("sync-modal"),
  syncOpen: document.getElementById("sync-open"),
  syncClose: document.getElementById("sync-close"),
  syncStatus: document.getElementById("sync-status"),
  syncCopy: document.getElementById("sync-copy"),
  syncExport: document.getElementById("sync-export"),
  syncImportFile: document.getElementById("sync-import-file"),
  syncPaste: document.getElementById("sync-paste"),
  syncApply: document.getElementById("sync-apply"),
  authBtn: document.getElementById("auth-btn"),
  syncCloudPanel: document.getElementById("sync-cloud-panel"),
  syncManualPanel: document.getElementById("sync-manual-panel"),
  syncCloudUser: document.getElementById("sync-cloud-user"),
  syncSubtitle: document.getElementById("sync-subtitle"),
  syncSetupPanel: document.getElementById("sync-setup-panel"),
  firebaseConfigInput: document.getElementById("firebase-config-input"),
  firebaseSave: document.getElementById("firebase-save"),
  firebaseSignin: document.getElementById("firebase-signin"),
};

function renderCover(game) {
  const initials = getInitials(game.title);
  const favorited = isFavorite(game.slug);

  const favoriteBtn = `
    <button
      class="favorite-btn${favorited ? " active" : ""}"
      type="button"
      data-action="favorite"
      data-slug="${escapeAttr(game.slug)}"
      aria-label="${favorited ? "Remove from favorites" : "Add to favorites"}"
      title="${favorited ? "Remove from favorites" : "Add to favorites"}"
    >${favorited ? "♥" : "♡"}</button>
  `;

  if (game.image) {
    return `
      <div class="card-cover">
        <img
          class="cover-img"
          src="${escapeAttr(game.image)}"
          alt="${escapeAttr(game.title)} cover"
          loading="lazy"
          decoding="async"
        />
        <div class="card-cover-fallback cover-fallback" hidden>${escapeHtml(initials)}</div>
        ${favoriteBtn}
      </div>
    `;
  }

  return `
    <div class="card-cover">
      <div class="card-cover-fallback">${escapeHtml(initials)}</div>
      ${favoriteBtn}
    </div>
  `;
}

function renderMetaBadge(game) {
  const failedCount = countFailedLinksForGame(game);
  const linkCount = countDownloadLinks(game.download_links);

  if (failedCount > 0) {
    return `
      <span class="meta-badge meta-badge-failed" title="${failedCount} failed link${failedCount > 1 ? "s" : ""}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 8v5M12 16h.01"></path>
        </svg>
        ${failedCount} failed
      </span>
    `;
  }

  return `
    <span class="meta-badge" title="${linkCount} download link${linkCount !== 1 ? "s" : ""}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      ${linkCount} link${linkCount !== 1 ? "s" : ""}
    </span>
  `;
}

function renderCard(game) {
  const favorited = isFavorite(game.slug);
  const linkStatus = getGameLinkStatus(game);

  return `
    <article
      class="game-card${favorited ? " is-favorite" : ""}"
      data-slug="${escapeAttr(game.slug)}"
      tabindex="0"
      role="button"
      aria-label="View links for ${escapeAttr(game.title)}"
    >
      ${renderCover(game)}
      <div class="card-footer">
        <div class="card-title-row">
          <span class="status-dot status-${linkStatus}" title="${linkStatus === "failed" ? "Has failed links" : "Links available"}"></span>
          <h2 class="card-title">${escapeHtml(game.title)}</h2>
        </div>
        <div class="card-meta-row">
          ${renderStars(game.rating)}
          ${renderMetaBadge(game)}
        </div>
      </div>
    </article>
  `;
}

function renderExternalLinks(game) {
  const links = [];
  if (game.gog_url) links.push({ label: "GOG Store", href: game.gog_url });
  if (game.gogdb_url) links.push({ label: "GOGDB", href: game.gogdb_url });
  if (game.magnet_link) links.push({ label: "Magnet", href: game.magnet_link });

  if (!links.length) return "";

  return `<div class="external-links">${links
    .map(
      (l) =>
        `<a class="link-chip" href="${escapeAttr(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`
    )
    .join("")}</div>`;
}

function renderDownloadLinkRow(slug, category, host, item) {
  const linkId = getLinkId(slug, category, host.id, item.link);
  const failed = isLinkFailed(linkId);

  return `
    <div class="download-row${failed ? " is-failed" : ""}">
      <a
        class="download-link"
        href="${escapeAttr(item.link)}"
        target="_blank"
        rel="noopener noreferrer"
        ${failed ? 'aria-disabled="true" tabindex="-1"' : ""}
      >${escapeHtml(item.label)}</a>
      <button
        class="fail-btn${failed ? " active" : ""}"
        type="button"
        data-action="toggle-failed"
        data-link-id="${escapeAttr(linkId)}"
        title="${failed ? "Mark as working" : "Mark as failed"}"
        aria-label="${failed ? "Mark as working" : "Mark as failed"}"
      >${failed ? "✕ Failed" : "Flag failed"}</button>
    </div>
  `;
}

function renderDownloadLinks(game) {
  const categories = Object.entries(game.download_links || {});
  if (!categories.length) {
    return '<p class="no-links">No download links available.</p>';
  }

  return categories
    .map(([categoryName, hosts]) => {
      const hostHtml = Object.values(hosts)
        .map((host) => {
          const links = (host.links || [])
            .map((item) => renderDownloadLinkRow(game.slug, categoryName, host, item))
            .join("");
          if (!links) return "";
          return `<div class="host-group"><div class="host-name">${escapeHtml(host.name || host.id)}</div>${links}</div>`;
        })
        .filter(Boolean)
        .join("");

      if (!hostHtml) return "";
      return `<div class="link-section"><h3>${escapeHtml(categoryName)}</h3>${hostHtml}</div>`;
    })
    .filter(Boolean)
    .join("");
}

function renderModal(game) {
  const thumb = game.image
    ? `<img class="modal-thumb" src="${escapeAttr(game.image)}" alt="" />`
    : `<div class="modal-thumb-fallback">${escapeHtml(getInitials(game.title))}</div>`;

  const subtitle = [game.developer, ...(game.genres || []).slice(0, 2)]
    .filter(Boolean)
    .join(" · ");

  const favorited = isFavorite(game.slug);
  const stars = renderStars(game.rating);

  els.modalContent.innerHTML = `
    <div class="modal-header">
      ${thumb}
      <div class="modal-title-wrap">
        <h2 class="modal-title">${escapeHtml(game.title)}</h2>
        ${subtitle ? `<p class="modal-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        <div class="modal-stars">${stars}</div>
      </div>
      <button
        class="modal-favorite-btn${favorited ? " active" : ""}"
        type="button"
        data-action="favorite"
        data-slug="${escapeAttr(game.slug)}"
        title="${favorited ? "Remove from favorites" : "Add to favorites"}"
      >${favorited ? "♥ Favorited" : "♡ Favorite"}</button>
      <button class="modal-close" type="button" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body">
      ${renderExternalLinks(game)}
      ${renderDownloadLinks(game)}
    </div>
  `;
}

function openModal(game) {
  state.selectedGame = game;
  renderModal(game);
  els.modal.classList.add("open");
  els.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  state.selectedGame = null;
  els.modal.classList.remove("open");
  els.modal.setAttribute("aria-hidden", "true");
  if (!els.syncModal.classList.contains("open")) {
    document.body.style.overflow = "";
  }
}

function updateSyncSetupUI() {
  const configured = isCloudSyncConfigured();
  const user = getCurrentUser();

  if (user) {
    els.syncSetupPanel.hidden = true;
    return;
  }

  els.syncSetupPanel.hidden = false;
  els.firebaseSave.hidden = configured;
  els.firebaseSignin.hidden = !configured;
}

function refreshSyncStatus() {
  const meta = getSyncMeta();
  const favorites = getFavorites().size;
  const failed = getFailedLinks().size;
  const user = getCurrentUser();

  updateSyncSetupUI();

  if (user) {
    els.syncCloudPanel.hidden = false;
    els.syncCloudUser.textContent = user.email || "Signed in with Google";
    els.syncSubtitle.textContent = "Your favorites and failed links sync across all devices.";
    els.syncManualPanel.querySelector(".sync-actions")?.setAttribute("hidden", "");
    els.syncStatus.textContent = `${favorites} favorites · ${failed} failed links · syncing automatically`;
    return;
  }

  els.syncCloudPanel.hidden = true;
  els.syncSubtitle.textContent = isCloudSyncConfigured()
    ? "Sign in with Google to sync across your devices."
    : "Set up free Google sync below, or use manual backup.";

  els.syncManualPanel.querySelector(".sync-actions")?.removeAttribute("hidden");

  const savedText = meta.updatedAt
    ? `Last saved ${new Date(meta.updatedAt).toLocaleString()}`
    : "Not saved yet on this device";

  els.syncStatus.textContent = `${savedText} · ${favorites} favorites · ${failed} failed links flagged`;
}

function updateAuthButton(user) {
  els.authBtn.hidden = false;

  if (user) {
    els.authBtn.textContent = "Sign out";
    els.authBtn.classList.add("signed-in");
    els.authBtn.title = user.email || "Signed in";
  } else {
    els.authBtn.textContent = "Sign in";
    els.authBtn.classList.remove("signed-in");
    els.authBtn.title = isCloudSyncConfigured()
      ? "Sign in with Google to sync across devices"
      : "Set up Google sync";
  }
}

async function startCloudSync() {
  setRemoteSyncCallback(notifyCloudPush);
  await initCloudSync({
    onRemoteUpdate: afterSyncApplied,
    onAuthChange: (signedInUser) => {
      updateAuthButton(signedInUser);
      refreshSyncStatus();
    },
  });
}

async function handleAuthClick() {
  if (!isCloudSyncConfigured()) {
    openSyncModal();
    return;
  }

  try {
    if (getCurrentUser()) {
      await signOutUser();
      showSyncToast("Signed out.");
    } else {
      await signInWithGoogle();
      if (getCurrentUser()) {
        showSyncToast("Signed in. Your data will sync automatically.");
      }
    }
  } catch (err) {
    showSyncToast(err.message, true);
  }
}

function openSyncModal() {
  refreshSyncStatus();
  els.syncPaste.value = "";
  els.syncModal.classList.add("open");
  els.syncModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

async function handleFirebaseSave() {
  try {
    const config = parseFirebaseConfigInput(els.firebaseConfigInput.value);
    saveFirebaseConfig(config);
    resetFirebaseSession();
    await startCloudSync();
    updateAuthButton(getCurrentUser());
    refreshSyncStatus();
    showSyncToast("Firebase connected. Now sign in with Google.");
  } catch (err) {
    showSyncToast(err.message, true);
  }
}

async function handleFirebaseSignIn() {
  try {
    await signInWithGoogle();
    if (getCurrentUser()) {
      showSyncToast("Signed in. Your data will sync automatically.");
    }
  } catch (err) {
    showSyncToast(err.message, true);
  }
}

function closeSyncModal() {
  els.syncModal.classList.remove("open");
  els.syncModal.setAttribute("aria-hidden", "true");
  if (!els.modal.classList.contains("open")) {
    document.body.style.overflow = "";
  }
}

function afterSyncApplied() {
  updateFavoritesCount();
  refreshSyncStatus();
  renderGrid();
  if (state.selectedGame) renderModal(state.selectedGame);
}

function showSyncToast(message, isError = false) {
  let toast = els.syncModal.querySelector(".sync-toast");
  if (!toast) {
    toast = document.createElement("p");
    toast.className = "sync-toast";
    els.syncModal.querySelector(".modal-body").appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle("error", isError);
}

function getPageSlice(games, page) {
  const start = (page - 1) * PAGE_SIZE;
  return games.slice(start, start + PAGE_SIZE);
}

function getTotalPages(count) {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

function renderPagination(totalItems) {
  const totalPages = getTotalPages(totalItems);

  if (totalPages <= 1) {
    els.pagination.innerHTML = "";
    return;
  }

  const { currentPage } = state;
  const pages = [];

  const addPage = (n) => {
    pages.push(
      `<button class="page-btn${n === currentPage ? " active" : ""}" data-page="${n}" type="button">${n}</button>`
    );
  };

  addPage(1);

  if (currentPage > 3) pages.push('<span class="page-info">…</span>');

  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    addPage(i);
  }

  if (currentPage < totalPages - 2) pages.push('<span class="page-info">…</span>');

  if (totalPages > 1) addPage(totalPages);

  els.pagination.innerHTML = `
    <button class="page-btn" data-action="prev" type="button" ${currentPage === 1 ? "disabled" : ""}>Previous</button>
    ${pages.join("")}
    <button class="page-btn" data-action="next" type="button" ${currentPage === totalPages ? "disabled" : ""}>Next</button>
    <span class="page-info">Page ${currentPage} of ${totalPages}</span>
  `;
}

function updateFavoritesCount() {
  const count = getFavorites().size;
  els.favoritesCount.textContent = count.toLocaleString();
}

function updateStats() {
  const shown = state.filteredGames.length;
  const total = state.view === "favorites" ? getFavorites().size : state.allGames.length;

  if (state.view === "favorites") {
    els.stats.textContent =
      shown === total
        ? `${shown.toLocaleString()} favorites`
        : `${shown.toLocaleString()} of ${total.toLocaleString()} favorites`;
    return;
  }

  els.stats.textContent =
    shown === state.allGames.length
      ? `${state.allGames.length.toLocaleString()} games`
      : `${shown.toLocaleString()} of ${state.allGames.length.toLocaleString()} games`;
}

function applyFilters() {
  let games = state.allGames;

  if (state.view === "favorites") {
    const favorites = getFavorites();
    games = games.filter((g) => favorites.has(g.slug));
  }

  const q = els.search.value.trim();
  if (q) {
    games = searchGames(games, q);
  }

  state.filteredGames = games;
}

function renderGrid() {
  applyFilters();
  const games = state.filteredGames;

  if (state.view === "favorites" && getFavorites().size === 0) {
    els.grid.innerHTML = `
      <div class="state-message">
        <h2>No favorites yet</h2>
        <p>Click the ♡ on any game to save it for later.</p>
      </div>
    `;
    els.pagination.innerHTML = "";
    updateStats();
    return;
  }

  if (!games.length) {
    els.grid.innerHTML = `
      <div class="state-message">
        <h2>No games found</h2>
        <p>Try a different search term.</p>
      </div>
    `;
    els.pagination.innerHTML = "";
    updateStats();
    return;
  }

  const pageGames = getPageSlice(games, state.currentPage);
  els.grid.innerHTML = `<div class="game-grid">${pageGames.map(renderCard).join("")}</div>`;
  renderPagination(games.length);
  updateStats();
}

function renderSkeleton() {
  const cards = Array.from({ length: 16 }, () => `
    <div class="skeleton-card">
      <div class="skeleton-cover"></div>
      <div class="skeleton-body">
        <div class="skeleton-line"></div>
      </div>
    </div>
  `).join("");

  els.grid.innerHTML = `<div class="skeleton-grid">${cards}</div>`;
}

function goToPage(page) {
  const totalPages = getTotalPages(state.filteredGames.length);
  state.currentPage = Math.min(Math.max(1, page), totalPages);
  renderGrid();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setView(view) {
  state.view = view;
  state.currentPage = 1;

  els.nav.querySelectorAll(".view-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });

  renderGrid();
}

function findGameBySlug(slug) {
  return state.allGames.find((g) => g.slug === slug);
}

function handleFavoriteToggle(slug) {
  toggleFavorite(slug);
  updateFavoritesCount();

  if (state.selectedGame?.slug === slug) {
    renderModal(state.selectedGame);
  }

  if (state.view === "favorites") {
    renderGrid();
    return;
  }

  const card = els.grid.querySelector(`.game-card[data-slug="${CSS.escape(slug)}"]`);
  if (card) {
    const game = findGameBySlug(slug);
    if (game) {
      const replacement = document.createRange().createContextualFragment(renderCard(game));
      card.replaceWith(replacement);
    }
  }
}

function handleFailedToggle(linkId) {
  toggleFailedLink(linkId);
  if (state.selectedGame) renderModal(state.selectedGame);

  const slug = state.selectedGame?.slug;
  if (!slug) return;

  const card = els.grid.querySelector(`.game-card[data-slug="${CSS.escape(slug)}"]`);
  if (card) {
    const game = findGameBySlug(slug);
    if (game) {
      const replacement = document.createRange().createContextualFragment(renderCard(game));
      card.replaceWith(replacement);
    }
  }
}

els.grid.addEventListener(
  "error",
  (event) => {
    if (!event.target.classList.contains("cover-img")) return;
    event.target.hidden = true;
    const fallback = event.target.nextElementSibling;
    if (fallback) fallback.hidden = false;
  },
  true
);

els.grid.addEventListener("click", (event) => {
  const favoriteBtn = event.target.closest('[data-action="favorite"]');
  if (favoriteBtn) {
    event.stopPropagation();
    handleFavoriteToggle(favoriteBtn.dataset.slug);
    return;
  }

  const card = event.target.closest(".game-card");
  if (!card) return;
  const game = findGameBySlug(card.dataset.slug);
  if (game) openModal(game);
});

els.grid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".game-card");
  if (!card) return;
  event.preventDefault();
  const game = findGameBySlug(card.dataset.slug);
  if (game) openModal(game);
});

els.modal.addEventListener("click", (event) => {
  const favoriteBtn = event.target.closest('[data-action="favorite"]');
  if (favoriteBtn) {
    handleFavoriteToggle(favoriteBtn.dataset.slug);
    return;
  }

  const failBtn = event.target.closest('[data-action="toggle-failed"]');
  if (failBtn) {
    handleFailedToggle(failBtn.dataset.linkId);
    return;
  }

  if (event.target === els.modal || event.target.closest(".modal-close")) {
    closeModal();
  }
});

els.pagination.addEventListener("click", (event) => {
  const btn = event.target.closest(".page-btn");
  if (!btn || btn.disabled) return;

  if (btn.dataset.page) {
    goToPage(Number(btn.dataset.page));
    return;
  }

  if (btn.dataset.action === "prev") goToPage(state.currentPage - 1);
  if (btn.dataset.action === "next") goToPage(state.currentPage + 1);
});

els.nav.addEventListener("click", (event) => {
  const tab = event.target.closest(".view-tab");
  if (!tab) return;
  setView(tab.dataset.view);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.selectedGame) closeModal();
  else if (els.syncModal.classList.contains("open")) closeSyncModal();
});

els.syncOpen.addEventListener("click", openSyncModal);
els.syncClose.addEventListener("click", closeSyncModal);
els.authBtn.addEventListener("click", handleAuthClick);
els.firebaseSave.addEventListener("click", handleFirebaseSave);
els.firebaseSignin.addEventListener("click", handleFirebaseSignIn);

els.syncModal.addEventListener("click", (event) => {
  if (event.target === els.syncModal) closeSyncModal();
});

els.syncCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(encodeSyncCode());
    showSyncToast("Sync code copied. Paste it on your other device.");
  } catch {
    showSyncToast("Could not copy. Use Download backup instead.", true);
  }
});

els.syncExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(exportUserData(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gog-browser-backup.json";
  link.click();
  URL.revokeObjectURL(url);
  showSyncToast("Backup downloaded.");
});

els.syncImportFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const result = importUserData(payload, { merge: true });
    afterSyncApplied();
    showSyncToast(`Imported ${result.favorites} favorites and ${result.failedLinks} failed links.`);
  } catch (err) {
    showSyncToast(err.message, true);
  } finally {
    event.target.value = "";
  }
});

els.syncApply.addEventListener("click", () => {
  try {
    const payload = decodeSyncCode(els.syncPaste.value);
    const result = importUserData(payload, { merge: true });
    els.syncPaste.value = "";
    afterSyncApplied();
    showSyncToast(`Synced ${result.favorites} favorites and ${result.failedLinks} failed links.`);
  } catch (err) {
    showSyncToast(err.message, true);
  }
});

els.search.addEventListener(
  "input",
  debounce(() => {
    state.currentPage = 1;
    renderGrid();
  }, 200)
);

async function init() {
  renderSkeleton();
  updateFavoritesCount();
  updateAuthButton(null);
  updateSyncSetupUI();

  if (isCloudSyncConfigured()) {
    await startCloudSync();
  }

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Game data not found. Run: npm run build");

    state.allGames = await res.json();
    state.currentPage = 1;
    renderGrid();
  } catch (err) {
    els.grid.innerHTML = `
      <div class="state-message error">
        <h2>Failed to load games</h2>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
    els.stats.textContent = "";
  }
}

init();

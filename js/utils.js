export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function getInitials(title) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function renderStars(rating) {
  if (rating == null) {
    return '<span class="stars stars-none" aria-label="No rating">—</span>';
  }

  const filled = Math.round(rating);
  const stars = Array.from({ length: 5 }, (_, i) => {
    const cls = i < filled ? "star filled" : "star";
    return `<span class="${cls}" aria-hidden="true">★</span>`;
  }).join("");

  return `<span class="stars" aria-label="Rating ${rating} out of 5">${stars}</span>`;
}

export function countDownloadLinks(downloadLinks) {
  let count = 0;
  for (const category of Object.values(downloadLinks || {})) {
    for (const host of Object.values(category)) {
      count += (host.links || []).length;
    }
  }
  return count;
}

function splitIntoWords(text) {
  return text
    .toLowerCase()
    .split(/[\s:,\-–—_]+/)
    .filter(Boolean);
}

function tokenMatchesWord(token, word) {
  return word === token || word.startsWith(token);
}

function tokenMatchesField(token, text) {
  return splitIntoWords(text).some((word) => tokenMatchesWord(token, word));
}

export function parseSearchTokens(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function gameMatchesSearch(game, tokens) {
  if (!tokens.length) return true;

  const title = game.title || "";
  const developer = game.developer || "";
  const slug = (game.slug || "").replaceAll("_", " ");
  const genres = (game.genres || []).join(" ");

  return tokens.every((token) => {
    if (tokenMatchesField(token, title)) return true;
    if (tokenMatchesField(token, slug)) return true;
    if (tokenMatchesField(token, developer)) return true;
    if ((game.genres || []).some((genre) => tokenMatchesWord(token, genre.toLowerCase()))) return true;
    return false;
  });
}

export function getSearchScore(game, tokens) {
  if (!tokens.length) return 0;

  const title = (game.title || "").toLowerCase();
  const titleWords = splitIntoWords(title);
  let score = 0;

  tokens.forEach((token, index) => {
    const weight = index === 0 ? 1 : 0.6;

    if (titleWords[0] === token) score += 1000 * weight;
    else if (title.startsWith(token)) score += 800 * weight;
    else if (titleWords.some((word) => word === token)) score += 500 * weight;
    else if (titleWords.some((word) => word.startsWith(token))) score += 300 * weight;
    else if (tokenMatchesField(token, title)) score += 100 * weight;

    if (tokenMatchesField(token, (game.slug || "").replaceAll("_", " "))) score += 80 * weight;
    if (tokenMatchesField(token, game.developer || "")) score += 40 * weight;
  });

  return score;
}

export function searchGames(games, query) {
  const tokens = parseSearchTokens(query);
  if (!tokens.length) return games;

  return games
    .filter((game) => gameMatchesSearch(game, tokens))
    .sort((a, b) => {
      const scoreDiff = getSearchScore(b, tokens) - getSearchScore(a, tokens);
      if (scoreDiff !== 0) return scoreDiff;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
}

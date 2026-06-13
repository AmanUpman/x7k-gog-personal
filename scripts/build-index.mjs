import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gamesDir = join(__dirname, "..", "gog-squid", "games");
const outputDir = join(__dirname, "..", "frontend", "data");
const outputPath = join(outputDir, "games.json");

const files = await readdir(gamesDir);
const games = [];

for (const file of files) {
  if (!file.endsWith(".json")) continue;

  const raw = await readFile(join(gamesDir, file), "utf8");
  const game = JSON.parse(raw);

  games.push({
    title: game.title,
    slug: game.slug,
    developer: game.developer ?? null,
    image: game.image ?? null,
    rating: game.rating ?? null,
    gog_url: game.gog_url ?? null,
    magnet_link: game.magnet_link ?? null,
    gogdb_url: game.gogdb_url ?? null,
    download_links: game.download_links ?? {},
    genres: game.genres ?? [],
  });
}

games.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(games));

console.log(`Built index with ${games.length} games → ${outputPath}`);

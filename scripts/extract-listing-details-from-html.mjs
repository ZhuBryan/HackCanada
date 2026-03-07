/**
 * Extract listing detail fields (beds, baths, sqft, pets, availability)
 * from a saved RentFaster search results HTML snapshot.
 *
 * RentFaster blocks server-side fetches (403), but the search results page
 * already contains beds/baths/pets/availability in the listing cards.
 * This script parses the saved HTML and merges the extracted details
 * into the existing livable-data JSON.
 *
 * Usage:
 *   node scripts/extract-listing-details-from-html.mjs [path-to-html]
 *
 * If no HTML path is given, it defaults to ../rentfaster.html (the workspace root).
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const dataDir = path.join(repoRoot, "data");

const htmlPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(workspaceRoot, "rentfaster.html");

const livableDataFile = path.join(dataDir, "rentfaster-listings.livable-data.json");
const outputFile = path.join(dataDir, "rentfaster-listings.detailed.json");

// ── HTML parsing helpers (no dependencies, just regex on rendered Angular HTML) ──

function extractListingBlocks(html) {
  // Each listing card starts with class="listing-item" and a listingid attribute
  const blocks = [];
  const regex = /class="listing-item[^"]*"[^>]*listingid="(\d+)"([\s\S]*?)(?=class="listing-item[^"]*"[^>]*listingid="|$)/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    blocks.push({
      listingId: match[1],
      html: match[2],
    });
  }

  // Fallback: try splitting by listingid attribute if the above misses some
  if (blocks.length === 0) {
    const fallback = /listingid="(\d+)"([\s\S]*?)(?=listingid="|$)/gi;
    while ((match = fallback.exec(html)) !== null) {
      blocks.push({
        listingId: match[1],
        html: match[2],
      });
    }
  }

  return blocks;
}

function clean(text) {
  return (text || "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseBeds(blockHtml) {
  // Pattern: "studio - 3 bd" or "2 bd" or "1 Bedroom" etc.
  const text = clean(blockHtml);

  // "studio" keyword
  const studioMatch = text.match(/\b(studio)\s*(?:-\s*(\d+))?\s*bd/i);
  if (studioMatch) {
    const max = studioMatch[2] ? parseInt(studioMatch[2], 10) : 0;
    return { bedsMin: 0, bedsMax: max, bedsLabel: studioMatch[0].trim() };
  }

  // "X - Y bd" range
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s*bd/i);
  if (rangeMatch) {
    return {
      bedsMin: parseInt(rangeMatch[1], 10),
      bedsMax: parseInt(rangeMatch[2], 10),
      bedsLabel: rangeMatch[0].trim(),
    };
  }

  // "X bd" single
  const singleMatch = text.match(/(\d+)\s*bd/i);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    return { bedsMin: n, bedsMax: n, bedsLabel: singleMatch[0].trim() };
  }

  // "X Bedroom(s)"
  const bedroomMatch = text.match(/(\d+)\s*bedroom/i);
  if (bedroomMatch) {
    const n = parseInt(bedroomMatch[1], 10);
    return { bedsMin: n, bedsMax: n, bedsLabel: `${n} bd` };
  }

  if (/\bstudio\b/i.test(text)) {
    return { bedsMin: 0, bedsMax: 0, bedsLabel: "Studio" };
  }

  return { bedsMin: null, bedsMax: null, bedsLabel: null };
}

function parseBaths(blockHtml) {
  const text = clean(blockHtml);

  // "X - Y ba" range
  const rangeMatch = text.match(/(\d+)\s*-\s*(\d+)\s*ba/i);
  if (rangeMatch) {
    return {
      bathsMin: parseInt(rangeMatch[1], 10),
      bathsMax: parseInt(rangeMatch[2], 10),
    };
  }

  // "X ba" single
  const singleMatch = text.match(/(\d+)\s*ba\b/i);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    return { bathsMin: n, bathsMax: n };
  }

  return { bathsMin: null, bathsMax: null };
}

function parseSqft(blockHtml) {
  const text = clean(blockHtml);
  const match = text.match(/([\d,]+)\s*(?:sq\.?\s*ft|sqft)/i);
  if (match) return parseInt(match[1].replace(/,/g, ""), 10);
  return null;
}

function parsePets(blockHtml) {
  const text = clean(blockHtml);
  if (/\bPets?\s*Ok\b/i.test(text)) return "pets_ok";
  if (/\bCats?\s*Ok\b/i.test(text)) return "cats_ok";
  if (/\bDogs?\s*Ok\b/i.test(text)) return "dogs_ok";
  if (/\bNo\s*pets?\b/i.test(text)) return "no_pets";
  return null;
}

function parseAvailability(blockHtml) {
  const text = clean(blockHtml);
  const match = text.match(/\b(Immediate availability|Available\s+\w+\s+\d{1,2}(?:,?\s*\d{4})?)/i);
  return match ? match[0].trim() : null;
}

function parsePropertyType(blockHtml) {
  const text = clean(blockHtml);
  if (/\bCondo\b/i.test(text)) return "Condo";
  if (/\bHouse\b/i.test(text)) return "House";
  if (/\bTownhouse\b/i.test(text) || /\bTownhome\b/i.test(text)) return "Townhouse";
  if (/\bBasement\b/i.test(text)) return "Basement";
  if (/\bRoom\b/i.test(text)) return "Room";
  return "Apartment";
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Reading HTML: ${htmlPath}`);
  const html = await readFile(htmlPath, "utf8");

  console.log(`Reading livable data: ${livableDataFile}`);
  const listings = JSON.parse(await readFile(livableDataFile, "utf8"));

  const blocks = extractListingBlocks(html);
  console.log(`Found ${blocks.length} listing blocks in HTML`);

  // Build a lookup by listing_id
  const detailsById = new Map();
  for (const block of blocks) {
    const beds = parseBeds(block.html);
    const baths = parseBaths(block.html);
    const sqft = parseSqft(block.html);
    const pets = parsePets(block.html);
    const availability = parseAvailability(block.html);
    const propertyType = parsePropertyType(block.html);

    detailsById.set(block.listingId, {
      bedsMin: beds.bedsMin,
      bedsMax: beds.bedsMax,
      bedsLabel: beds.bedsLabel,
      bathsMin: baths.bathsMin,
      bathsMax: baths.bathsMax,
      sqft,
      pets,
      availability,
      propertyType,
    });
  }

  // Merge into livable data
  let matched = 0;
  const enriched = listings.map((listing) => {
    const details = detailsById.get(listing.listing_id);
    if (details) {
      matched++;
      return { ...listing, details };
    }
    return { ...listing, details: null };
  });

  await mkdir(dataDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(enriched, null, 2) + "\n", "utf8");

  console.log(
    JSON.stringify(
      {
        htmlPath,
        livableDataFile,
        outputFile,
        htmlBlocks: blocks.length,
        livableListings: listings.length,
        matched,
        unmatched: listings.length - matched,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Listing, ScoreBand } from "@/lib/avenuex-data";

// ── Raw data types (same shape as /api/listings) ─────────────────────────────

interface NearbyBucket {
  count: number;
}

interface RawListing {
  listing_id: string;
  url: string | null;
  title: string | null;
  location: string | null;
  price: string | null;
  photo: string | null;
  lat: number | null;
  lng: number | null;
  nearby?: {
    schools?: NearbyBucket;
    groceries?: NearbyBucket;
    restaurants?: NearbyBucket;
    cafes?: NearbyBucket;
    parks?: NearbyBucket;
    pharmacies?: NearbyBucket;
    transit?: NearbyBucket;
  };
}

// ── Bucket definitions ───────────────────────────────────────────────────────

const BUCKET_KEYS = [
  "schools",
  "groceries",
  "restaurants",
  "cafes",
  "parks",
  "pharmacies",
  "transit",
] as const;

type BucketKey = (typeof BUCKET_KEYS)[number];

const BUCKET_LABELS: Record<BucketKey, string> = {
  schools: "Schools",
  groceries: "Grocery",
  restaurants: "Restaurants",
  cafes: "Cafes",
  parks: "Parks",
  pharmacies: "Pharmacies",
  transit: "Transit",
};

// ── Helpers (duplicated minimally to keep this route self-contained) ─────────

function parsePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^0-9]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

function extractCity(location: string | null | undefined): string {
  if (!location) return "Toronto, ON";
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  const city = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? "Toronto";
  return `${city}, ON`;
}

function extractAddress(location: string | null | undefined): string {
  if (!location) return "Unknown address";
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] ?? location;
}

function bucketScore(count: number | undefined): number {
  return Math.round(Math.min(count ?? 0, 5) / 5 * 100);
}

function deriveBand(score: number): ScoreBand {
  if (score >= 70) return "great";
  if (score >= 45) return "medium";
  return "warning";
}

function deriveStatus(band: ScoreBand): string {
  if (band === "great") return "Great neighborhood access";
  if (band === "medium") return "Moderate neighborhood access";
  return "Limited neighborhood access";
}

function formatShortPrice(rent: number): string {
  if (rent >= 1000) return `$${(rent / 1000).toFixed(1)}K`;
  return `$${rent}`;
}

function computeIncomeNeeded(monthlyRent: number): number {
  return Math.round((monthlyRent / 0.3) * 12 / 1000) * 1000;
}

// ── Personal scoring ─────────────────────────────────────────────────────────

interface Weights {
  schools: number;
  groceries: number;
  restaurants: number;
  cafes: number;
  parks: number;
  pharmacies: number;
  transit: number;
}

function computePersonalScore(
  nearby: RawListing["nearby"],
  weights: Weights
): number {
  if (!nearby) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of BUCKET_KEYS) {
    const w = weights[key];
    if (w <= 0) continue;
    const count = nearby[key]?.count ?? 0;
    const normalized = Math.min(count, 5) / 5;
    weightedSum += w * normalized;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

function buildMatchReason(nearby: RawListing["nearby"], weights: Weights): string {
  if (!nearby) return "No nearby data available";

  const scored: { key: BucketKey; contribution: number }[] = [];

  for (const key of BUCKET_KEYS) {
    const w = weights[key];
    const count = nearby[key]?.count ?? 0;
    const normalized = Math.min(count, 5) / 5;
    scored.push({ key, contribution: w * normalized });
  }

  scored.sort((a, b) => b.contribution - a.contribution);

  const top = scored.slice(0, 2).filter((s) => s.contribution > 0);
  if (top.length === 0) return "Limited data for your priorities";

  const labels = top.map((s) => BUCKET_LABELS[s.key].toLowerCase());
  return `Strong ${labels.join(" and ")} access`;
}

// ── Data loading ─────────────────────────────────────────────────────────────

let cachedRaw: RawListing[] | null = null;

async function loadRaw(): Promise<RawListing[]> {
  if (cachedRaw) return cachedRaw;
  const filePath = path.join(process.cwd(), "data", "rentfaster-listings.livable-data.json");
  const raw = await readFile(filePath, "utf8");
  cachedRaw = JSON.parse(raw);
  return cachedRaw!;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const maxRent = searchParams.has("maxRent")
      ? parseInt(searchParams.get("maxRent")!, 10)
      : Infinity;

    const weights: Weights = {
      schools: parseWeight(searchParams.get("w_schools")),
      groceries: parseWeight(searchParams.get("w_groceries")),
      restaurants: parseWeight(searchParams.get("w_restaurants")),
      cafes: parseWeight(searchParams.get("w_cafes")),
      parks: parseWeight(searchParams.get("w_parks")),
      pharmacies: parseWeight(searchParams.get("w_pharmacies")),
      transit: parseWeight(searchParams.get("w_transit")),
    };

    const rawListings = await loadRaw();

    const results: (Listing & { personalScore: number; matchReason: string })[] = rawListings
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => {
        const monthlyRent = parsePrice(item.price);
        const city = extractCity(item.location);
        const address = extractAddress(item.location);
        const nearby = item.nearby ?? {};

        const foodDrink = Math.round(
          (bucketScore(nearby.restaurants?.count) + bucketScore(nearby.cafes?.count)) / 2
        );
        const health = bucketScore(nearby.pharmacies?.count);
        const groceryParks = Math.round(
          (bucketScore(nearby.groceries?.count) + bucketScore(nearby.parks?.count)) / 2
        );
        const education = bucketScore(nearby.schools?.count);
        const emergency = Math.round(health * 0.6 + bucketScore(nearby.transit?.count) * 0.4);

        const score = Math.round((foodDrink + health + groceryParks + education + emergency) / 5);
        const scoreBand = deriveBand(score);

        const personalScore = computePersonalScore(item.nearby, weights);
        const matchReason = buildMatchReason(item.nearby, weights);

        return {
          id: `rf-${item.listing_id}`,
          address,
          city,
          fullAddress: item.location ?? address,
          monthlyRent,
          priceLabel: `$${monthlyRent.toLocaleString()}/mo`,
          shortPrice: formatShortPrice(monthlyRent),
          beds: 1,
          baths: 1,
          sqft: 0,
          propertyType: "Apartment" as const,
          score,
          scoreStatus: deriveStatus(scoreBand),
          scoreBand,
          image: item.photo ?? "",
          pinX: "50%",
          pinY: "50%",
          lat: item.lat!,
          lng: item.lng!,
          availableDate: "Available now",
          leaseTerm: "12 months",
          about: item.title ?? "",
          amenities: buildAmenityLabels(nearby),
          categoryScores: { foodDrink, health, groceryParks, education, emergency },
          incomeNeeded: computeIncomeNeeded(monthlyRent),
          personalScore,
          matchReason,
        };
      })
      .filter((listing) => Number.isFinite(maxRent) ? listing.monthlyRent <= maxRent : true)
      .sort((a, b) => b.personalScore - a.personalScore);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to compute suggestions:", error);
    return NextResponse.json({ error: "Failed to compute suggestions" }, { status: 500 });
  }
}

// ── Small helpers ────────────────────────────────────────────────────────────

function parseWeight(raw: string | null): number {
  if (!raw) return 5;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, n));
}

function buildAmenityLabels(
  nearby: Record<string, NearbyBucket | undefined>
): string[] {
  const labels: string[] = [];
  for (const key of BUCKET_KEYS) {
    const count = nearby[key]?.count ?? 0;
    if (count > 0) labels.push(`${count} ${BUCKET_LABELS[key].toLowerCase()}`);
  }
  return labels;
}

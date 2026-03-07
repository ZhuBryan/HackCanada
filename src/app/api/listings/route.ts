import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Listing, ScoreBand } from "@/lib/avenuex-data";

// ── Types for the raw livable-data JSON ──────────────────────────────────────

interface NearbyBucket {
  label: string;
  source: string;
  radius_meters: number;
  count: number;
  places: {
    name: string;
    address: string | null;
    distance_meters: number | null;
    categories: string[];
  }[];
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
  geocode_display_name: string | null;
  geocode_found: boolean;
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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Data loading ─────────────────────────────────────────────────────────────

let cachedListings: Listing[] | null = null;

async function loadListings(): Promise<Listing[]> {
  if (cachedListings) return cachedListings;

  const filePath = path.join(process.cwd(), "data", "rentfaster-listings.livable-data.json");
  const raw = await readFile(filePath, "utf8");
  const items: RawListing[] = JSON.parse(raw);

  cachedListings = items
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .map((item): Listing => {
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
        propertyType: "Apartment",
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
      };
    });

  return cachedListings;
}

function buildAmenityLabels(
  nearby: RawListing["nearby"]
): string[] {
  if (!nearby) return [];
  const labels: string[] = [];
  if ((nearby.schools?.count ?? 0) > 0) labels.push(`${nearby.schools!.count} schools nearby`);
  if ((nearby.groceries?.count ?? 0) > 0) labels.push(`${nearby.groceries!.count} grocery stores`);
  if ((nearby.restaurants?.count ?? 0) > 0) labels.push(`${nearby.restaurants!.count} restaurants`);
  if ((nearby.cafes?.count ?? 0) > 0) labels.push(`${nearby.cafes!.count} cafes`);
  if ((nearby.parks?.count ?? 0) > 0) labels.push(`${nearby.parks!.count} parks`);
  if ((nearby.pharmacies?.count ?? 0) > 0) labels.push(`${nearby.pharmacies!.count} pharmacies`);
  if ((nearby.transit?.count ?? 0) > 0) labels.push(`${nearby.transit!.count} transit stops`);
  return labels;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const listings = await loadListings();
    return NextResponse.json(listings);
  } catch (error) {
    console.error("Failed to load listings:", error);
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 });
  }
}

// Export for internal reuse by the suggestions route
export { loadListings };

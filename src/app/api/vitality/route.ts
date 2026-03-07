import { NextResponse } from "next/server";
import type { Amenity } from "@/lib/types";

type OverpassElement = {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type AmenityType =
  | "cafe"
  | "restaurant"
  | "grocery"
  | "transit"
  | "park"
  | "healthcare"
  | "pharmacy"
  | "other";

function toMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111000;
  const dLon = (lon2 - lon1) * 82000;
  return Math.round(Math.sqrt(dLat * dLat + dLon * dLon));
}

function classify(tags: Record<string, string>): { type: AmenityType; weight: number } {
  if (tags.amenity === "pharmacy") return { type: "pharmacy", weight: 28 };
  if (tags.amenity === "clinic" || tags.amenity === "hospital")
    return { type: "healthcare", weight: 26 };
  if (tags.shop === "supermarket" || tags.shop === "convenience")
    return { type: "grocery", weight: 22 };
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food")
    return { type: "restaurant", weight: 16 };
  if (tags.amenity === "cafe") return { type: "cafe", weight: 14 };
  if (tags.highway === "bus_stop" || tags.railway === "tram_stop")
    return { type: "transit", weight: 12 };
  if (tags.leisure === "park") return { type: "park", weight: 10 };
  return { type: "other", weight: 6 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computeAmenityRating(weight: number, distance: number, radius: number): number {
  const typeScore = (weight / 28) * 55;
  const distanceScore = clamp(1 - distance / radius, 0, 1) * 45;
  return Math.round(clamp(typeScore + distanceScore, 20, 99));
}

function estimateWalkMinutes(distance: number): number {
  return Math.max(1, Math.round(distance / 80));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function pickVariant(options: string[], seed: string): string {
  if (options.length === 0) return "";
  return options[hashString(seed) % options.length];
}

function qualityLabel(rating: number): string {
  if (rating >= 85) return "Top pick";
  if (rating >= 72) return "Great fit";
  if (rating >= 58) return "Solid option";
  return "Useful backup";
}

function amenityDescription(params: {
  type: AmenityType;
  tags: Record<string, string>;
  rating: number;
  distance: number;
  walkMinutes: number;
  isSmallBusiness: boolean;
  seed: string;
}): string {
  const { type, tags, rating, distance, walkMinutes, isSmallBusiness, seed } = params;

  const quality = qualityLabel(rating);
  const hours = tags.opening_hours ? `Hours: ${tags.opening_hours}.` : "";
  const wheelchair = tags.wheelchair === "yes" ? "Wheelchair accessible." : "";
  const locality = isSmallBusiness ? "Independent local spot." : "";
  const transitHint =
    walkMinutes <= 5 ? "Quick stop before/after work." : "Still realistic for regular routines.";

  const templatesByType: Record<AmenityType, string[]> = {
    grocery: [
      `${quality}: about ${distance}m away (${walkMinutes} min). Easy for weekday restocks and quick essentials.`,
      `${quality}: ${walkMinutes}-minute walk for groceries, useful for cutting delivery dependence.`,
      `${quality}: nearby grocery access helps keep day-to-day costs and errands predictable.`,
      `${quality}: practical for meal prep runs and top-up trips during the week.`,
    ],
    pharmacy: [
      `${quality}: ${walkMinutes}-minute pharmacy access can reduce friction for prescriptions and urgent items.`,
      `${quality}: close enough (${distance}m) for same-day health errands when plans change.`,
      `${quality}: reliable pharmacy proximity for routine meds and quick personal-care runs.`,
      `${quality}: good coverage for health essentials without long detours.`,
    ],
    healthcare: [
      `${quality}: nearby care option (${walkMinutes} min) improves access when timing matters.`,
      `${quality}: healthcare access within ${distance}m supports better day-to-day resilience.`,
      `${quality}: practical medical access for non-emergency visits and follow-ups.`,
      `${quality}: good to have close-by care in your neighborhood routine.`,
    ],
    transit: [
      `${quality}: transit is ${walkMinutes} minutes away. ${transitHint}`,
      `${quality}: ${distance}m to transit helps keep commute variability lower.`,
      `${quality}: strong transit adjacency for flexible routing across the city.`,
      `${quality}: nearby stop supports easier no-car days and mixed-mode commutes.`,
    ],
    park: [
      `${quality}: park access in about ${walkMinutes} minutes adds recovery and activity options.`,
      `${quality}: nearby green space supports daily walks and weekend downtime.`,
      `${quality}: useful for outdoor breaks without planning a long trip.`,
      `${quality}: park proximity helps balance dense city living with open space access.`,
    ],
    restaurant: [
      `${quality}: food options in a ${walkMinutes}-minute walk range for quick meals and social plans.`,
      `${quality}: strong nearby dining coverage (${distance}m) for flexible weeknight choices.`,
      `${quality}: practical restaurant access when you need low-friction meal options.`,
      `${quality}: nearby dining cluster improves convenience for both takeout and dine-in.`,
    ],
    cafe: [
      `${quality}: cafe access within ${walkMinutes} minutes for coffee, quick meetings, or remote work breaks.`,
      `${quality}: nearby cafe option adds third-space flexibility to your routine.`,
      `${quality}: strong coffee/tea convenience with minimal detour from home.`,
      `${quality}: practical for short focus sessions or casual meetups nearby.`,
    ],
    other: [
      `${quality}: nearby amenity access (${distance}m) adds useful day-to-day flexibility.`,
      `${quality}: close-by local service that can reduce small weekly detours.`,
      `${quality}: convenient neighborhood option for routine errands.`,
      `${quality}: good supplemental amenity coverage around this listing.`,
    ],
  };

  const main = pickVariant(templatesByType[type], `${seed}:${type}:${rating}:${distance}`);
  return `${main} ${locality} ${hours} ${wheelchair}`.replace(/\s+/g, " ").trim();
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  if (!latParam || !lngParam) {
    return NextResponse.json(
      { error: "lat and lng search parameters are required" },
      { status: 400 },
    );
  }

  const lat = parseFloat(latParam);
  const lng = parseFloat(lngParam);
  const radius = 700;

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"](around:${radius},${lat},${lng});
      node["amenity"="restaurant"](around:${radius},${lat},${lng});
      node["amenity"="fast_food"](around:${radius},${lat},${lng});
      node["shop"="supermarket"](around:${radius},${lat},${lng});
      node["shop"="convenience"](around:${radius},${lat},${lng});
      node["highway"="bus_stop"](around:${radius},${lat},${lng});
      node["railway"="tram_stop"](around:${radius},${lat},${lng});
      node["amenity"="clinic"](around:${radius},${lat},${lng});
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      node["amenity"="pharmacy"](around:${radius},${lat},${lng});
      node["leisure"="park"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  try {
    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) {
      throw new Error(`Overpass API status: ${response.status}`);
    }

    const data = (await response.json()) as { elements?: OverpassElement[] };
    const elements = Array.isArray(data.elements) ? data.elements : [];

    const byName = new Map<string, Amenity>();
    let rawScore = 0;

    for (const element of elements) {
      if (!element.tags) continue;
      const name = element.tags.name?.trim();
      if (!name) continue;

      const { type, weight } = classify(element.tags);
      const distance = toMeters(lat, lng, element.lat, element.lon);
      const rating = computeAmenityRating(weight, distance, radius);
      const walkMinutes = estimateWalkMinutes(distance);
      const isSmallBusiness = Boolean(
        type === "cafe" || type === "restaurant" || element.tags.shop === "convenience",
      );
      rawScore += weight;

      const amenity: Amenity = {
        id: String(element.id),
        name,
        type,
        coords: [element.lat, element.lon],
        distance,
        rating,
        walkMinutes,
        address: buildAddress(element.tags),
        description: amenityDescription({
          type,
          tags: element.tags,
          rating,
          distance,
          walkMinutes,
          isSmallBusiness,
          seed: `${element.id}:${name}:${lat.toFixed(4)}:${lng.toFixed(4)}`,
        }),
        source: "OpenStreetMap (Overpass)",
        isSmallBusiness,
      };

      const existing = byName.get(name);
      if (!existing || amenity.distance < existing.distance) {
        byName.set(name, amenity);
      }
    }

    const amenities = Array.from(byName.values())
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    const vitalityScore = Math.max(0, Math.min(100, Math.round((rawScore / 220) * 100)));

    return NextResponse.json({
      vitalityScore,
      amenities,
      source: "overpass",
      radiusMeters: radius,
    });
  } catch (error) {
    console.error("Overpass API Error:", error);
    return NextResponse.json(
      {
        vitalityScore: 45,
        amenities: [],
        source: "fallback",
        error: "Failed to fetch live amenities",
      },
      { status: 200 },
    );
  }
}

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
      rawScore += weight;

      const amenity: Amenity = {
        id: String(element.id),
        name,
        type,
        coords: [element.lat, element.lon],
        distance,
        isSmallBusiness: Boolean(
          type === "cafe" || type === "restaurant" || element.tags.shop === "convenience",
        ),
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

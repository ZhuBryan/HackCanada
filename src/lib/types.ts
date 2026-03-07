/**
 * Avenue-X: Shared TypeScript types
 * This is the "Handshake" schema all team members rely on.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Amenity {
  id: string;
  name: string;
  type: string;
  distance: number;       // meters from rental
  coords: [number, number]; // [lat, lng]
  isSmallBusiness?: boolean;
}

export interface RentalListing {
  id: string;
  address: string;
  coordinates: Coordinates;
  price: number;
  stories?: number;
  propertyType?: "house" | "apartment";
  amenities: Amenity[];
}

/**
 * Convert GPS offset to 3D scene coordinates.
 * The rental is at (0, 0, 0). Businesses are placed relative to it.
 *
 * At Toronto/Waterloo latitude (~43.5°):
 * - 1° latitude  ≈ 111,000 m
 * - 1° longitude ≈  82,000 m (cos(43.5°) × 111,000)
 */
export function gpsTo3D(
  businessCoords: [number, number],
  centerCoords: Coordinates,
  scaleFactor: number = 80
): [number, number, number] {
  const LAT_METERS = 111000;
  const LNG_METERS = 82000; // approximate for ~43.5° latitude

  const dx = (businessCoords[1] - centerCoords.lng) * LNG_METERS;
  const dz = (businessCoords[0] - centerCoords.lat) * LAT_METERS;

  // Scale down to scene units (1 unit ≈ ~6m at scaleFactor=80)
  return [
    (dx / 500) * scaleFactor * 0.5,
    3 + Math.random() * 2, // Y offset: float businesses above ground
    (dz / 500) * scaleFactor * 0.5,
  ];
}

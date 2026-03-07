"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Listing } from "@/lib/avenuex-data";
import { scoreColor } from "@/components/avenuex/primitives";

interface SelectedAmenity {
  id: string;
  name: string;
  type: string;
  distance: number;
  coords: [number, number];
}

interface MapboxMapProps {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedAmenities?: SelectedAmenity[];
}

type BuildingId = string | number;

export function MapboxMap({ listings, selectedId, onSelect, selectedAmenities = [] }: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const listingsRef = useRef(listings);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  const listingToFeatureIdsRef = useRef<Map<string, Set<BuildingId>>>(new Map());
  const featureToListingIdRef = useRef<Map<BuildingId, string>>(new Map());
  const activeSelectedBuildingIdsRef = useRef<Set<BuildingId>>(new Set());

  useEffect(() => {
    listingsRef.current = listings;
  }, [listings]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  function setSelectedBuildingState(map: mapboxgl.Map, nextSelectedId: string | null) {
    for (const featureId of activeSelectedBuildingIdsRef.current) {
      map.setFeatureState(
        { source: "composite", sourceLayer: "building", id: featureId },
        { selected: false },
      );
    }
    activeSelectedBuildingIdsRef.current.clear();

    if (!nextSelectedId) return;
    const ids = listingToFeatureIdsRef.current.get(nextSelectedId);
    if (!ids) return;

    for (const featureId of ids) {
      map.setFeatureState(
        { source: "composite", sourceLayer: "building", id: featureId },
        { selected: true },
      );
      activeSelectedBuildingIdsRef.current.add(featureId);
    }
  }

  const addMarker = (map: mapboxgl.Map, listing: Listing, active: boolean) => {
    const element = document.createElement("div");
    element.style.cssText = markerBaseStyle(active, listing.score);
    element.dataset.score = String(listing.score);
    element.textContent = listing.shortPrice;
    element.addEventListener("click", () => onSelectRef.current(listing.id));

    const marker = new mapboxgl.Marker({ element, anchor: "bottom" })
      .setLngLat([listing.lng, listing.lat])
      .addTo(map);

    markersRef.current.set(listing.id, marker);
  };

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-79.3832, 43.6532],
      zoom: 13.5,
      pitch: 48,
      bearing: -10,
      dragRotate: false,
      antialias: true,
      maxTileCacheSize: 20,
      maxBounds: [
        [-80.15, 43.35],
        [-78.95, 44.1],
      ],
    });

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    const pulseInterval = window.setInterval(() => {
      if (!map.getLayer("selected-bubble")) return;
      const t = Date.now() / 600;
      const radius = 18 + Math.sin(t) * 4;
      map.setPaintProperty("selected-bubble", "circle-radius", radius);
    }, 120);

    map.on("load", () => {
      map.setFog({
        range: [0.5, 6],
        color: "#f5f0e8",
        "horizon-blend": 0.04,
      });

      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 12,
        paint: {
          "fill-extrusion-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#16A34A",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 85],
            "#15803d",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 75],
            "#4ade80",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 65],
            "#fbbf24",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 55],
            "#f97316",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 35],
            "#dc2626",
            "#ede8dc",
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.9,
        },
      });

      map.addSource("selected-listing", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.addLayer({
        id: "selected-bubble",
        type: "circle",
        source: "selected-listing",
        paint: {
          "circle-radius": 18,
          "circle-color": "#22c55e",
          "circle-opacity": 0.18,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#16a34a",
        },
      });
      map.addLayer({
        id: "selected-core",
        type: "circle",
        source: "selected-listing",
        paint: {
          "circle-radius": 6,
          "circle-color": "#16a34a",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      map.addSource("amenity-paths", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.addLayer({
        id: "amenity-path-lines",
        type: "line",
        source: "amenity-paths",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#38bdf8"],
          "line-width": 2.5,
          "line-opacity": 0.82,
        },
      });
      map.addLayer({
        id: "amenity-path-points",
        type: "circle",
        source: "amenity-paths",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4.5,
          "circle-color": ["coalesce", ["get", "color"], "#38bdf8"],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "amenity-path-labels",
        type: "symbol",
        source: "amenity-paths",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 0.8],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });

      const listingFeatureIds = new Set<BuildingId>();

      const applyListingHighlights = () => {
        for (const id of listingFeatureIds) {
          map.setFeatureState(
            { source: "composite", sourceLayer: "building", id },
            { listingScore: 0, selected: false },
          );
        }
        listingFeatureIds.clear();
        listingToFeatureIdsRef.current.clear();
        featureToListingIdRef.current.clear();

        const buildingFeatures = map.querySourceFeatures("composite", {
          sourceLayer: "building",
          filter: ["==", "extrude", "true"],
        });

        for (const listing of listingsRef.current) {
          let nearest: (typeof buildingFeatures)[number] | null = null;
          let nearestDist = Infinity;
          for (const feature of buildingFeatures) {
            if (feature.id == null) continue;
            const d = minDistToGeom(listing.lng, listing.lat, feature.geometry);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = feature;
            }
          }
          if (!nearest) continue;

          const anchorKeys = vertexKeySet(nearest.geometry, 5);
          const idsForListing = new Set<BuildingId>();

          for (const feature of buildingFeatures) {
            if (feature.id == null) continue;
            const touches =
              feature.id === nearest.id ||
              vertexKeys(feature.geometry, 5).some((key) => anchorKeys.has(key));
            if (!touches) continue;

            listingFeatureIds.add(feature.id);
            idsForListing.add(feature.id);
            featureToListingIdRef.current.set(feature.id, listing.id);
            map.setFeatureState(
              { source: "composite", sourceLayer: "building", id: feature.id },
              { listingScore: listing.score },
            );
          }

          if (idsForListing.size > 0) {
            listingToFeatureIdsRef.current.set(listing.id, idsForListing);
          }
        }

        setSelectedBuildingState(map, selectedIdRef.current);
      };

      applyListingHighlights();
      map.on("idle", applyListingHighlights);

      map.on("mouseenter", "3d-buildings", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "3d-buildings", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "3d-buildings", (event) => {
        const featureId = event.features?.[0]?.id as BuildingId | undefined;
        if (featureId != null) {
          const mappedListingId = featureToListingIdRef.current.get(featureId);
          if (mappedListingId) {
            onSelectRef.current(mappedListingId);
            return;
          }
        }

        const clicked = event.lngLat;
        const nearestListing = listingsRef.current
          .map((listing) => ({
            listing,
            distance: Math.hypot(listing.lng - clicked.lng, listing.lat - clicked.lat),
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.listing;

        if (nearestListing) {
          onSelectRef.current(nearestListing.id);
        }
      });

      for (const listing of listingsRef.current) {
        addMarker(map, listing, listing.id === selectedIdRef.current);
      }
    });

    const markers = markersRef.current;
    return () => {
      window.clearInterval(pulseInterval);
      markers.forEach((marker) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const currentIds = new Set(listings.map((listing) => listing.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    for (const listing of listings) {
      if (!markersRef.current.has(listing.id)) {
        addMarker(map, listing, listing.id === selectedId);
      }
    }

    markersRef.current.forEach((marker, id) => {
      applyMarkerStyle(marker.getElement(), id === selectedId);
    });
  }, [listings, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    markersRef.current.forEach((marker, id) => {
      applyMarkerStyle(marker.getElement(), id === selectedId);
    });

    setSelectedBuildingState(map, selectedId);

    const selectedListing = selectedId ? listings.find((listing) => listing.id === selectedId) : null;
    const selectedSource = map.getSource("selected-listing") as mapboxgl.GeoJSONSource | undefined;
    if (selectedSource) {
      selectedSource.setData(
        selectedListing
          ? {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { id: selectedListing.id },
                  geometry: {
                    type: "Point",
                    coordinates: [selectedListing.lng, selectedListing.lat],
                  },
                },
              ],
            }
          : { type: "FeatureCollection", features: [] },
      );
    }

    if (selectedListing) {
      map.flyTo({
        center: [selectedListing.lng, selectedListing.lat],
        zoom: 17.5,
        pitch: 52,
        duration: 900,
        essential: true,
      });
    }
  }, [selectedId, listings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const selectedListing = selectedId ? listings.find((listing) => listing.id === selectedId) : null;
    const source = map.getSource("amenity-paths") as mapboxgl.GeoJSONSource | undefined;
    if (!source || !selectedListing) return;

    const features: GeoJSON.Feature[] = [];
    for (const amenity of selectedAmenities) {
      const [lat, lng] = amenity.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const color = colorForAmenityType(amenity.type);

      features.push({
        type: "Feature",
        properties: {
          id: `line-${amenity.id}`,
          name: amenity.name,
          type: amenity.type,
          color,
          distance: amenity.distance,
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [selectedListing.lng, selectedListing.lat],
            [lng, lat],
          ],
        },
      });

      features.push({
        type: "Feature",
        properties: {
          id: amenity.id,
          name: amenity.name,
          type: amenity.type,
          color,
          distance: amenity.distance,
        },
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
      });
    }

    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [selectedAmenities, selectedId, listings]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function colorForAmenityType(type: string): string {
  switch (type) {
    case "grocery":
      return "#22C55E";
    case "pharmacy":
    case "healthcare":
      return "#EC4899";
    case "cafe":
    case "restaurant":
      return "#F97316";
    case "park":
      return "#10B981";
    case "transit":
      return "#3B82F6";
    default:
      return "#38BDF8";
  }
}

function markerBaseStyle(active: boolean, score: number): string {
  return [
    `background: ${scoreColor(score)}`,
    "color: white",
    "padding: 5px 12px",
    "border-radius: 999px",
    "font-size: 11px",
    "font-weight: 700",
    "cursor: pointer",
    `border: 2px solid ${active ? "#0f172a" : "white"}`,
    "white-space: nowrap",
    "transition: background 0.15s, border-color 0.15s",
    "font-family: Inter, sans-serif",
    "letter-spacing: -0.3px",
    `transform: scale(${active ? "1.15" : "1"})`,
    `z-index: ${active ? "10" : "1"}`,
    "display: inline-block",
    "width: max-content",
    "line-height: 1.2",
  ].join("; ");
}

function applyMarkerStyle(el: HTMLElement, active: boolean) {
  el.style.borderColor = active ? "#0f172a" : "white";
  el.style.transform = `scale(${active ? "1.15" : "1"})`;
  el.style.zIndex = active ? "10" : "1";
}

function rings(geom: GeoJSON.Geometry): [number, number][][] {
  if (geom.type === "Polygon") return geom.coordinates as [number, number][][];
  if (geom.type === "MultiPolygon") return (geom.coordinates as [number, number][][][]).flat();
  return [];
}

function minDistToGeom(px: number, py: number, geom: GeoJSON.Geometry): number {
  let min = Infinity;
  for (const ring of rings(geom)) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
      min = Math.min(min, (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2);
    }
  }
  return Math.sqrt(min);
}

function vertexKeySet(geom: GeoJSON.Geometry, decimals: number): Set<string> {
  return new Set(vertexKeys(geom, decimals));
}

function vertexKeys(geom: GeoJSON.Geometry, decimals: number): string[] {
  return rings(geom)
    .flat()
    .map(([vx, vy]) => `${vx.toFixed(decimals)},${vy.toFixed(decimals)}`);
}

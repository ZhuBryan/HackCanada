"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Listing } from "@/lib/avenuex-data";
import { scoreColor } from "@/components/avenuex/primitives";

interface MapboxMapProps {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapboxMap({ listings, selectedId, onSelect }: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const highlightDirtyRef = useRef(true);
  const triggerHighlightRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-79.3832, 43.6532],
      zoom: 14,
      pitch: 45,
      bearing: -10,
      dragRotate: false,
      antialias: false,
      maxTileCacheSize: 20,
      maxBounds: [[-79.65, 43.55], [-79.10, 43.85]],
    });

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

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
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 85], "#15803d",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 75], "#4ade80",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 65], "#fbbf24",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 55], "#f97316",
            [">=", ["coalesce", ["feature-state", "listingScore"], 0], 35], "#dc2626",
            "#ede8dc",
          ],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.85,
        },
      });

      // ── Listing building highlights ────────────────────────────────────────
      // querySourceFeatures for geographic accuracy — avoids the pitch/occlusion
      // problem of screen-space queryRenderedFeatures.
      const listingFeatureIds = new Set<string | number>();

      const applyListingHighlights = () => {
        if (!highlightDirtyRef.current) return;
        highlightDirtyRef.current = false;
        listingFeatureIds.forEach((id) => {
          map.setFeatureState(
            { source: "composite", sourceLayer: "building", id },
            { listingScore: 0 }
          );
        });
        listingFeatureIds.clear();

        const buildingFeatures = map.querySourceFeatures("composite", {
          sourceLayer: "building",
          filter: ["==", "extrude", "true"],
        });

        for (const listing of listingsRef.current) {
          // Find nearest building feature geographically
          let nearest: (typeof buildingFeatures)[number] | null = null;
          let nearestDist = Infinity;
          for (const feature of buildingFeatures) {
            if (feature.id == null) continue;
            const d = minDistToGeom(listing.lng, listing.lat, feature.geometry);
            if (d < nearestDist) { nearestDist = d; nearest = feature; }
          }
          if (!nearest) continue;

          // Stamp nearest + every building sharing a vertex with it
          const anchorKeys = vertexKeySet(nearest.geometry, 5);
          for (const feature of buildingFeatures) {
            if (feature.id == null) continue;
            const touches =
              feature.id === nearest.id ||
              vertexKeys(feature.geometry, 5).some((k) => anchorKeys.has(k));
            if (touches) {
              listingFeatureIds.add(feature.id);
              map.setFeatureState(
                { source: "composite", sourceLayer: "building", id: feature.id },
                { listingScore: listing.score }
              );
            }
          }
        }
      };

      triggerHighlightRef.current = applyListingHighlights;

      map.on("sourcedata", (e) => {
        if (e.sourceId === "composite" && e.isSourceLoaded) {
          highlightDirtyRef.current = true;
        }
      });

      applyListingHighlights();
      map.on("idle", applyListingHighlights);

      // ── GTA boundary mask ──────────────────────────────────────────────────
      map.addSource("gta-mask", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]],
              [
                [-79.3832, 43.7732],
                [-79.3181, 43.7641],
                [-79.2631, 43.7380],
                [-79.2261, 43.6991],
                [-79.2132, 43.6532],
                [-79.2261, 43.6073],
                [-79.2631, 43.5684],
                [-79.3181, 43.5423],
                [-79.3832, 43.5332],
                [-79.4483, 43.5423],
                [-79.5033, 43.5684],
                [-79.5403, 43.6073],
                [-79.5532, 43.6532],
                [-79.5403, 43.6991],
                [-79.5033, 43.7380],
                [-79.4483, 43.7641],
                [-79.3832, 43.7732],
              ],
            ],
          },
        },
      });
      map.addLayer({
        id: "gta-mask",
        type: "fill",
        source: "gta-mask",
        paint: {
          "fill-color": "#e8e8e8",
          "fill-opacity": 1,
        },
      });

      // ── Markers ────────────────────────────────────────────────────────────
      for (const listing of listingsRef.current) {
        addMarker(map, listing, listing.id === selectedId);
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync markers when listings change (filter/sort)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const currentIds = new Set(listings.map((l) => l.id));
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

    // Re-stamp building colors when listings change
    highlightDirtyRef.current = true;
    triggerHighlightRef.current?.();
  }, [listings, selectedId]);

  // Update marker styles + fly when selectedId changes
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      applyMarkerStyle(marker.getElement(), id === selectedId);
    });

    if (selectedId && mapRef.current) {
      const listing = listings.find((l) => l.id === selectedId);
      if (listing) {
        mapRef.current.flyTo({
          center: [listing.lng, listing.lat],
          zoom: 17.5,
          pitch: 45,
          duration: 900,
          essential: true,
        });
      }
    }
  }, [selectedId, listings]);

  function addMarker(map: mapboxgl.Map, listing: Listing, active: boolean) {
    const el = document.createElement("div");
    el.style.cssText = markerBaseStyle(active, listing.score);
    el.dataset.score = String(listing.score);
    el.textContent = listing.shortPrice;
    el.addEventListener("click", () => onSelectRef.current(listing.id));

    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([listing.lng, listing.lat])
      .addTo(map);

    markersRef.current.set(listing.id, marker);
  }

  return <div ref={containerRef} className="h-full w-full" />;
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
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j], [x2, y2] = ring[i];
      const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
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
  return rings(geom).flat().map(([vx, vy]) => `${vx.toFixed(decimals)},${vy.toFixed(decimals)}`);
}

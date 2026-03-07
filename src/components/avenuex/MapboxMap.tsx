"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Listing } from "@/lib/avenuex-data";

interface MapboxMapProps {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function MapboxMap({ listings, selectedId, onSelect }: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      // Performance: disable antialiasing (big win on CPU-only machines)
      antialias: false,
      // Limit tile cache to reduce memory pressure
      maxTileCacheSize: 20,
    });

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      // Lightweight 3D buildings — no shadows, no AO
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#ede8dc",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.75,
        },
      });

      for (const listing of listings) {
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
          zoom: 15,
          pitch: 45,
          duration: 700,
          essential: true,
        });
      }
    }
  }, [selectedId, listings]);

  function addMarker(map: mapboxgl.Map, listing: Listing, active: boolean) {
    const el = document.createElement("div");
    el.style.cssText = markerBaseStyle(active);
    el.textContent = listing.shortPrice;
    el.addEventListener("click", () => onSelectRef.current(listing.id));

    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([listing.lng, listing.lat])
      .addTo(map);

    markersRef.current.set(listing.id, marker);
  }

  return <div ref={containerRef} className="h-full w-full" />;
}

function markerBaseStyle(active: boolean): string {
  return [
    `background: ${active ? "#0f172a" : "#22C55E"}`,
    "color: white",
    "padding: 5px 12px",
    "border-radius: 999px",
    "font-size: 11px",
    "font-weight: 700",
    "cursor: pointer",
    "border: 2px solid white",
    "white-space: nowrap",
    "transition: background 0.15s, transform 0.15s",
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
  el.style.background = active ? "#0f172a" : "#22C55E";
  el.style.transform = `scale(${active ? "1.15" : "1"})`;
  el.style.zIndex = active ? "10" : "1";
}

"use client";

import React, { useRef, useState, useEffect } from "react";
import { SPIDER_CATEGORIES } from "@/components/avenuex/SpiderChart";
import { useSpiderPrefs, type SpiderAxes } from "@/lib/spider-prefs-context";
import type { Listing } from "@/lib/avenuex-data";

export function pxy(angleDeg: number, r: number, cx: number, cy: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function PrefsWidget() {
    const { prefs, setPrefs, widgetOpen, openWidget, closeWidget, openChat } = useSpiderPrefs();
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragging, setDragging] = useState<{ key: keyof SpiderAxes; i: number } | null>(null);
    const prefsRef = useRef(prefs);

    useEffect(() => {
        prefsRef.current = prefs;
    }, [prefs]);

    const SZ = 220, CX = 110, CY = 110, MR = 78;
    const STEP = 360 / 8;
    const RINGS = [25, 50, 75, 100];

    useEffect(() => {
        const end = () => setDragging(null);
        window.addEventListener("mouseup", end);
        window.addEventListener("touchend", end);
        return () => { window.removeEventListener("mouseup", end); window.removeEventListener("touchend", end); };
    }, []);

    const getValFromEvent = (clientX: number, clientY: number, i: number) => {
        if (!svgRef.current) return null;
        const rect = svgRef.current.getBoundingClientRect();
        const mx = ((clientX - rect.left) / rect.width) * SZ;
        const my = ((clientY - rect.top) / rect.height) * SZ;
        const rad = ((i * STEP - 90) * Math.PI) / 180;
        const dot = (mx - CX) * Math.cos(rad) + (my - CY) * Math.sin(rad);
        return Math.max(0, Math.min(100, Math.round((dot / MR) * 100)));
    };

    const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!dragging) return;
        const val = getValFromEvent(e.clientX, e.clientY, dragging.i);
        if (val !== null) setPrefs({ ...prefsRef.current, [dragging.key]: val });
    };

    const onSvgTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
        if (!dragging || !e.touches[0]) return;
        const val = getValFromEvent(e.touches[0].clientX, e.touches[0].clientY, dragging.i);
        if (val !== null) setPrefs({ ...prefsRef.current, [dragging.key]: val });
    };

    const startDrag = (key: keyof SpiderAxes, i: number, e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setDragging({ key, i });
    };

    const polyPts = SPIDER_CATEGORIES.map(({ key }, i) => {
        const { x, y } = pxy(i * STEP, ((prefs[key] ?? 0) / 100) * MR, CX, CY);
        return `${x},${y}`;
    }).join(" ");

    if (!widgetOpen) {
        return (
            <button
                type="button"
                className="absolute top-4 left-4 z-10 rounded-full border px-3 py-1.5 flex items-center gap-1.5 transition hover:opacity-90"
                style={{ backgroundColor: "rgba(250,248,245,0.95)", borderColor: "var(--line)", backdropFilter: "blur(12px)", boxShadow: "0 2px 12px rgba(28,25,23,0.10)" }}
                onClick={openWidget}
            >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--brand)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>My Preferences</span>
            </button>
        );
    }

    return (
        <div
            className="absolute top-4 left-4 z-10 rounded-2xl border overflow-hidden"
            style={{ backgroundColor: "rgba(250,248,245,0.97)", borderColor: "var(--line)", backdropFilter: "blur(14px)", boxShadow: "0 4px 24px rgba(28,25,23,0.13)", width: 256 }}
        >
            <div className="flex items-center justify-between px-3 pt-2.5 pb-0.5">
                <span className="label-overline" style={{ whiteSpace: "nowrap" }}>My Preferences</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px]" style={{ color: "var(--muted-light)", whiteSpace: "nowrap" }}>drag to adjust</span>
                    <button
                        type="button"
                        onClick={() => setPrefs({ walkability: 50, nourishment: 50, wellness: 50, greenery: 50, buzz: 50, essentials: 50, safety: 50, transit: 50 })}
                        className="text-[10px] transition hover:text-red-400"
                        style={{ color: "var(--muted-light)" }}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={closeWidget}
                        className="text-base leading-none transition hover:opacity-60 ml-0.5"
                        style={{ color: "var(--muted-light)" }}
                    >
                        ×
                    </button>
                </div>
            </div>

            {dragging && (
                <div className="mx-3 mb-0.5 flex items-center justify-between rounded-lg px-2 py-1" style={{ backgroundColor: "var(--brand-soft)" }}>
                    <span className="text-[11px] font-semibold" style={{ color: "var(--brand-ink)" }}>
                        {SPIDER_CATEGORIES.find(c => c.key === dragging.key)?.label}
                    </span>
                    <span className="text-[11px] font-bold font-mono" style={{ color: "var(--brand-ink)" }}>
                        {prefs[dragging.key]}
                    </span>
                </div>
            )}

            <div className="flex justify-center" style={{ paddingBottom: 8 }}>
                <svg
                    ref={svgRef}
                    width={SZ} height={SZ}
                    viewBox={`0 0 ${SZ} ${SZ}`}
                    style={{ overflow: "visible", cursor: dragging ? "grabbing" : "default", userSelect: "none" }}
                    onMouseMove={onSvgMouseMove}
                    onTouchMove={onSvgTouchMove}
                >
                    {RINGS.map((ring) => {
                        const r = (ring / 100) * MR;
                        const pts = SPIDER_CATEGORIES.map((_, i) => {
                            const { x, y } = pxy(i * STEP, r, CX, CY);
                            return `${x},${y}`;
                        }).join(" ");
                        return (
                            <polygon key={ring} points={pts} fill="none"
                                stroke="var(--line)"
                                strokeWidth={ring === 100 ? 1.2 : 0.7}
                                strokeDasharray={ring === 100 ? undefined : "3,3"} />
                        );
                    })}

                    {SPIDER_CATEGORIES.map(({ key }, i) => {
                        const { x, y } = pxy(i * STEP, MR, CX, CY);
                        return (
                            <g key={key}>
                                <line x1={CX} y1={CY} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.7} />
                                <line x1={CX} y1={CY} x2={x} y2={y}
                                    stroke="transparent" strokeWidth={20}
                                    style={{ cursor: "grab" }}
                                    onMouseDown={(e) => startDrag(key as keyof SpiderAxes, i, e)}
                                    onTouchStart={(e) => startDrag(key as keyof SpiderAxes, i, e)}
                                />
                            </g>
                        );
                    })}

                    <polygon
                        points={polyPts}
                        fill="rgba(99,102,241,0.10)"
                        stroke="#6366F1"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        style={{ transition: dragging ? undefined : "all 0.25s ease" }}
                    />

                    {SPIDER_CATEGORIES.map(({ key, color }, i) => {
                        const r = ((prefs[key] ?? 0) / 100) * MR;
                        const { x, y } = pxy(i * STEP, r, CX, CY);
                        const isActive = dragging?.key === key;
                        return (
                            <circle key={key} cx={x} cy={y}
                                r={isActive ? 7 : 5}
                                fill={isActive ? color : "white"}
                                stroke={color}
                                strokeWidth={isActive ? 0 : 2.5}
                                style={{
                                    cursor: "grab",
                                    transition: dragging ? undefined : "all 0.25s ease",
                                    filter: isActive ? `drop-shadow(0 0 4px ${color}88)` : undefined,
                                }}
                                onMouseDown={(e) => startDrag(key as keyof SpiderAxes, i, e)}
                                onTouchStart={(e) => startDrag(key as keyof SpiderAxes, i, e)}
                            />
                        );
                    })}

                    {SPIDER_CATEGORIES.map(({ key, label, color }, i) => {
                        const { x, y } = pxy(i * STEP, MR + 19, CX, CY);
                        const isActive = dragging?.key === key;
                        return (
                            <text key={label} x={x} y={y}
                                textAnchor="middle" dominantBaseline="central"
                                style={{
                                    fontSize: isActive ? 10 : 9,
                                    fontWeight: isActive ? 700 : 500,
                                    fill: isActive ? color : "var(--muted-light)",
                                    fontFamily: "var(--font-dm-sans), system-ui",
                                    transition: "all 0.15s ease",
                                    pointerEvents: "none",
                                }}>
                                {label}
                            </text>
                        );
                    })}
                </svg>
            </div>

            <div className="border-t px-3 py-2 flex justify-end" style={{ borderColor: "var(--line)" }}>
                <button
                    type="button"
                    onClick={openChat}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80"
                    style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand-ink)" }}
                >
                    Chat to adjust ›
                </button>
            </div>
        </div>
    );
}

export function deriveListingAxes(listing: Listing): SpiderAxes {
    const cs = listing.categoryScores;
    const ns = listing.nearbyServices;
    const n = (count: number | undefined, cap: number) =>
        count !== undefined ? Math.min(100, Math.round((count / cap) * 100)) : null;
    return {
        walkability: Math.round((cs.foodDrink + cs.groceryParks + cs.education) / 3),
        nourishment: cs.foodDrink,
        wellness: Math.round((cs.health + (n(ns?.pharmacies, 5) ?? cs.health)) / 2),
        greenery: Math.round((cs.groceryParks + (n(ns?.parks, 15) ?? cs.groceryParks)) / 2),
        buzz: Math.round(cs.foodDrink * 0.88),
        essentials: Math.round((cs.groceryParks + cs.education) / 2),
        safety: cs.emergency,
        transit: n(ns?.transit, 12) ?? Math.round(listing.score * 0.85),
    };
}

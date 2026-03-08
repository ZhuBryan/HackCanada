import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
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
    nearby?: Record<string, { count: number }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BUCKET_KEYS = ["schools", "groceries", "restaurants", "cafes", "parks", "pharmacies", "transit"] as const;

function parsePrice(raw: string | null | undefined): number {
    if (!raw) return 0;
    const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
}

function extractAddress(location: string | null | undefined): string {
    if (!location) return "Unknown address";
    return location.split(",").map((s) => s.trim()).filter(Boolean)[0] ?? location;
}

function computeIncomeNeeded(monthlyRent: number): number {
    return Math.round(((monthlyRent / 0.3) * 12) / 1000) * 1000;
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

// ── Gemini path ──────────────────────────────────────────────────────────────

async function buildSystemPrompt(): Promise<string> {
    const rawListings = await loadRaw();
    const validListings = rawListings.filter(
        (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)
    );
    const summaries = validListings
        .map((item) => {
            const rent = parsePrice(item.price);
            const addr = extractAddress(item.location);
            const nb = item.nearby ?? {};
            const buckets = BUCKET_KEYS.map((k) => `${k}: ${nb[k]?.count ?? 0}`).join(", ");
            const income = computeIncomeNeeded(rent);
            return `• rf-${item.listing_id}: ${addr} ($${rent}/mo) @ ${item.lat},${item.lng} | ${buckets} | income: $${Math.round(income / 1000)}K+`;
        })
        .join("\n");

    return `You are Canopi, a warm and sharp AI assistant for a Toronto rental platform. You help renters find apartments and understand neighborhoods.

You MUST always respond with a valid JSON object in this exact shape:
{
  "content": "<your natural language reply here>",
  "prefUpdate": { "walkability": 0-100, "nourishment": 0-100, "wellness": 0-100, "greenery": 0-100, "buzz": 0-100, "essentials": 0-100, "safety": 0-100, "transit": 0-100 } | null
}

THE 8 PREFERENCE AXES (each 0–100):
- walkability: ability to do errands/commute on foot
- nourishment: restaurants, cafes, food variety nearby
- wellness: gyms, clinics, pharmacies, health services
- greenery: parks, trails, trees, nature access
- buzz: nightlife, bars, entertainment, social energy
- essentials: groceries, pharmacies, day-to-day needs
- safety: low crime, quiet, family-friendly feel
- transit: subway, bus, streetcar access

PREFERENCE INFERENCE RULES:
Set prefUpdate ONLY when the user is describing their lifestyle, personality, or what they like/need. Set it to null for pure questions (budgets, addresses, "what's near X", etc.).

When you do infer preferences, use these mappings as a guide and blend intelligently:
- Gaming, esports, nightlife, bars, clubbing → buzz:85, transit:75, nourishment:70
- Outdoors, hiking, dog owner, nature lover → greenery:90, walkability:85
- Work from home, introvert, quiet, peaceful → greenery:75, buzz:20, essentials:70, walkability:65
- Student, budget-conscious, broke → transit:88, essentials:78, walkability:72
- Family, kids, schools → safety:90, essentials:82, greenery:75, buzz:20, walkability:70
- Fitness, gym, yoga, cycling, running → wellness:88, walkability:82, greenery:70
- Foodie, restaurants, brunch, coffee, cafes → nourishment:92, buzz:68, walkability:75
- Remote work, coffee shops, coworking → nourishment:78, walkability:80, buzz:62, transit:65
- Healthcare worker, elderly care → wellness:90, transit:80, essentials:78
- Nightlife, party, social butterfly → buzz:90, nourishment:80, transit:78
- Artist, creative, culture → buzz:75, nourishment:70, walkability:72
- Minimalist, zen, introverted → greenery:80, safety:78, buzz:25

You can blend multiple signals (e.g. "I'm a gamer who loves coffee" → merge gaming + foodie axes).
Only include axes you have a clear signal for. For axes you have no signal on, use 50.

LISTING DATA — ${validListings.length} real Toronto rentals:
${summaries}

LISTING RECOMMENDATION RULES:
1. When asked for suggestions, recommend 2-3 specific listings using actual addresses and prices from the data.
2. For location queries, use lat/lng to find closest listings.
3. Toronto landmarks: CN Tower (43.643, -79.387), Union Station (43.645, -79.381), U of T (43.663, -79.396), King & Spadina (43.644, -79.396).
4. Format recommendations as: "**[Address]** — $X,XXX/mo (Income needed: $XXK+)"

Keep replies concise and conversational. Always return valid JSON — no markdown fences, no extra text outside the JSON.`;
}

interface GeminiResult {
    content: string;
    prefUpdate: Record<string, number> | null;
}

async function geminiResponse(messages: ChatMessage[]): Promise<GeminiResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No Gemini API key");

    const systemPrompt = await buildSystemPrompt();

    const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    maxOutputTokens: 600,
                    temperature: 0.7,
                    responseMimeType: "application/json",
                },
            }),
        }
    );

    if (!res.ok) {
        const text = await res.text();
        console.error("Gemini API error:", text);
        throw new Error("Gemini API request failed");
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    try {
        const parsed = JSON.parse(raw);
        return {
            content: parsed.content ?? "I'm not sure how to help with that.",
            prefUpdate: parsed.prefUpdate ?? null,
        };
    } catch {
        return { content: raw, prefUpdate: null };
    }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const messages: ChatMessage[] = body.messages ?? [];

        if (messages.length === 0) {
            return NextResponse.json({ role: "assistant", content: "Please send a message to get started!" });
        }

        const result = await geminiResponse(messages);
        return NextResponse.json({ role: "assistant", content: result.content, prefUpdate: result.prefUpdate });
    } catch (error) {
        console.error("Chat route error:", error);
        return NextResponse.json(
            { role: "assistant", content: "Sorry, something went wrong. Please try again." },
            { status: 500 }
        );
    }
}

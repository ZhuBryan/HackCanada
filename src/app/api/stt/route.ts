import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });

    const formData = await request.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) return NextResponse.json({ error: "No audio provided" }, { status: 400 });

    const elForm = new FormData();
    elForm.append("file", audio, "recording.webm");
    elForm.append("model_id", "scribe_v1");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: elForm,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs STT error:", err);
      return NextResponse.json({ error: "STT request failed" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text ?? "" });
  } catch (error) {
    console.error("STT route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

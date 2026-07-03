export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

const _API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://sentinel-ai-2uo3.onrender.com"
    : "http://localhost:8000");

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const res = await fetch(`${_API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name?.trim() ?? null, email, password, role: "USER" }),
    });

    const data = await res.json() as { detail?: string; user?: { id: string; email: string; role: string } };

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? "Registration failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(
      { id: data.user!.id, email: data.user!.email, role: data.user!.role },
      { status: 201 }
    );
  } catch (e) {
    console.error("[register] proxy error:", e);
    return NextResponse.json(
      { error: "Registration failed. Backend may be unreachable." },
      { status: 500 }
    );
  }
}

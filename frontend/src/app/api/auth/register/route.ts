export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: name?.trim() || null, email: normalizedEmail, password: hashed },
      select: { id: true, email: true, role: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json(
      { error: "Registration failed. Is PostgreSQL running and DATABASE_URL set?" },
      { status: 500 }
    );
  }
}

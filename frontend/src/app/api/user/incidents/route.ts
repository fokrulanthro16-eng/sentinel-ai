export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incidents = await prisma.userIncident.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(incidents);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const incident = await prisma.userIncident.create({
    data: {
      userId: session.user.id,
      incidentId: body.incidentId ?? `inc-${Date.now()}`,
      title: body.title,
      severity: body.severity,
      locationName: body.location_name ?? "",
      lat: body.lat ?? 0,
      lng: body.lng ?? 0,
    },
  });
  return NextResponse.json(incident, { status: 201 });
}

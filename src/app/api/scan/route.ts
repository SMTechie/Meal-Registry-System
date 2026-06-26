import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { claimMealScan } from "@/lib/scan";

export async function POST(request: Request) {
  const user = await requireRole([Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN]);
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "");

  if (!code.trim()) {
    return NextResponse.json({ status: "DENIED", reason: "No QR code was supplied." }, { status: 400 });
  }

  const result = await claimMealScan(code, user.id);
  return NextResponse.json(result);
}

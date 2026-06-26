import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { Role } from "@prisma/client";
import { currentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  if (viewer.id !== id && !isAdmin(viewer)) return new NextResponse("Forbidden", { status: 403 });
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (user.role !== Role.USER && !isAdmin(viewer)) return new NextResponse("Forbidden", { status: 403 });

  const buffer = await QRCode.toBuffer(user.qrAccessCode, {
    width: 360,
    margin: 2,
    color: { dark: "#111827", light: "#ffffff" }
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store"
    }
  });
}

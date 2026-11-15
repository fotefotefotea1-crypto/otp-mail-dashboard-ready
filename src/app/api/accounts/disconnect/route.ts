import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/session";
import { disconnectAccount } from "@/lib/msal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.accountId !== "string" || body.accountId.length > 300) {
    return NextResponse.json({ error: "Account ID invalid" }, { status: 400 });
  }
  try {
    const deleted = await disconnectAccount(body.accountId);
    return NextResponse.json({ ok: deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถยกเลิกการเชื่อมต่อได้" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { isMicrosoftConfigured } from "@/lib/config";
import { listConnectedAccounts } from "@/lib/msal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = isMicrosoftConfigured() ? await listConnectedAccounts() : [];
    return NextResponse.json({ accounts, microsoftConfigured: isMicrosoftConfigured() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถอ่านรายการบัญชีได้ ตรวจสอบการตั้งค่า" }, { status: 500 });
  }
}

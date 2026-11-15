import { NextRequest, NextResponse } from "next/server";
import { getAccountAccessToken } from "@/lib/msal";
import { extractOtps } from "@/lib/otp.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GraphResponse = { value?: Array<{
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}> };

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId || accountId.length > 300) return NextResponse.json({ error: "ต้องเลือกบัญชีก่อน" }, { status: 400 });
  try {
    const accessToken = await getAccountAccessToken(accountId);
    const params = new URLSearchParams({
      "$select": "id,subject,bodyPreview,body,receivedDateTime,from",
      "$top": "100",
      "$orderby": "receivedDateTime desc",
    });
    const graph = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", Prefer: 'outlook.body-content-type="html"' },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!graph.ok) {
      const message = graph.status === 429 ? "Microsoft จำกัดการเรียกชั่วคราว กรุณาลองอีกครั้ง" :
        graph.status === 401 || graph.status === 403 ? "สิทธิ์อ่านอีเมลไม่เพียงพอ กรุณาเชื่อมต่อบัญชีใหม่" :
        "อ่านกล่องจดหมายไม่สำเร็จ ลองใหม่อีกครั้ง";
      return NextResponse.json({ error: message }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    const payload = (await graph.json()) as GraphResponse;
    const items = extractOtps(payload.value || []);
    return NextResponse.json({ items, scanned: (payload.value || []).length, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถอ่านอีเมลได้";
    const allowed = message.includes("สิทธิ์เข้าถึง") || message.includes("ไม่พบบัญชี") ? message : "ไม่สามารถอ่านอีเมลได้ ตรวจสอบอินเทอร์เน็ตและการตั้งค่า";
    return NextResponse.json({ error: allowed }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

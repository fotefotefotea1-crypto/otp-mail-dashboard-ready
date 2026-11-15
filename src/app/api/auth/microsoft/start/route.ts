import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getRedirectUri, isMicrosoftConfigured, isSecure, OAUTH_COOKIE, SCOPES } from "@/lib/config";
import { isSameOrigin, signValue } from "@/lib/session";
import { withMsal } from "@/lib/msal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isMicrosoftConfigured()) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า Microsoft App Registration" }, { status: 400 });
  try {
    const state = randomBytes(24).toString("hex");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const url = await withMsal((app) => app.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
      state,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      prompt: "select_account",
    }));
    const flow = Buffer.from(JSON.stringify({ state, verifier, created: Date.now() })).toString("base64url");
    const response = NextResponse.json({ url });
    response.cookies.set(OAUTH_COOKIE, signValue(flow), {
      httpOnly: true, sameSite: "lax", secure: isSecure, path: "/api/auth/microsoft", maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "ไม่สามารถเริ่มเชื่อมต่อ Microsoft ได้ ตรวจสอบการตั้งค่า" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { APP_URL, getRedirectUri, isSecure, OAUTH_COOKIE, SCOPES } from "@/lib/config";
import { verifySignedValue } from "@/lib/session";
import { withMsal } from "@/lib/msal";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const target = new URL(APP_URL);
  target.searchParams.set("result", "connection-error");
  const response = NextResponse.redirect(target);
  response.cookies.set(OAUTH_COOKIE, "", {
    httpOnly: true, sameSite: "lax", secure: isSecure, path: "/api/auth/microsoft", maxAge: 0,
  });
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stored = verifySignedValue(request.cookies.get(OAUTH_COOKIE)?.value);
  if (!code || !state || !stored) return response;
  try {
    const flow = JSON.parse(Buffer.from(stored, "base64url").toString("utf8"));
    if (flow.state !== state || typeof flow.verifier !== "string" ||
        typeof flow.created !== "number" || Date.now() - flow.created > 10 * 60 * 1000) return response;
    await withMsal(async (app) => {
      const result = await app.acquireTokenByCode({
        code,
        scopes: SCOPES,
        redirectUri: getRedirectUri(),
        codeVerifier: flow.verifier,
      });
      if (!result?.account) throw new Error("Account missing after OAuth");
    });
    const success = new URL(APP_URL);
    success.searchParams.set("result", "connected");
    response.headers.set("Location", success.toString());
  } catch {
    // Never log or expose authorization codes, access tokens, or callback query.
  }
  return response;
}

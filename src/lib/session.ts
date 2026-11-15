import { createHmac, timingSafeEqual } from "node:crypto";

function signature(value: string) {
  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  if (!secret) throw new Error("Missing STORAGE_ENCRYPTION_KEY");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signValue(payload: string) {
  return `${payload}.${signature(payload)}`;
}

export function verifySignedValue(raw?: string) {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 1) return null;
  const payload = raw.slice(0, i);
  const a = Buffer.from(raw.slice(i + 1));
  const b = Buffer.from(signature(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(process.env.APP_URL || "http://localhost:3000").origin;
  } catch {
    return false;
  }
}

export const APP_URL = process.env.APP_URL || "http://localhost:3000";
export const SCOPES = ["User.Read", "Mail.Read"];
export const OAUTH_COOKIE = "otp_oauth_flow";

export const isMicrosoftConfigured = () => Boolean(
  process.env.MICROSOFT_CLIENT_ID &&
  process.env.MICROSOFT_CLIENT_SECRET
);

export function getRedirectUri() {
  return `${APP_URL.replace(/\/$/, "")}/api/auth/microsoft/callback`;
}

export const isSecure = process.env.NODE_ENV === "production" && APP_URL.startsWith("https://");

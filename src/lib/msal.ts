import { ConfidentialClientApplication, type AccountInfo } from "@azure/msal-node";
import { SCOPES } from "./config";
import { readEncryptedCache, writeEncryptedCache } from "./store";

let tail: Promise<void> = Promise.resolve();

/** Serialise local cache operations so multiple requests do not overwrite each other. */
export async function withMsal<T>(handler: (app: ConfidentialClientApplication) => Promise<T>): Promise<T> {
  let unlock!: () => void;
  const previous = tail;
  tail = new Promise<void>((resolve) => { unlock = resolve; });
  await previous;
  try {
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET) {
      throw new Error("ยังไม่ได้ตั้งค่า MICROSOFT_CLIENT_ID และ MICROSOFT_CLIENT_SECRET");
    }
    const app = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        authority: "https://login.microsoftonline.com/consumers",
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      },
    });
    const original = await readEncryptedCache();
    if (original) app.getTokenCache().deserialize(original);
    try {
      return await handler(app);
    } finally {
      const next = app.getTokenCache().serialize();
      if (next !== original) await writeEncryptedCache(next);
    }
  } finally {
    unlock();
  }
}

export async function listConnectedAccounts() {
  return withMsal(async (app) => {
    const items = await app.getTokenCache().getAllAccounts();
    return items.map((account) => ({ id: account.homeAccountId, email: account.username, provider: "Microsoft" }));
  });
}

export async function getAccountAccessToken(accountId: string): Promise<string> {
  return withMsal(async (app) => {
    const accounts: AccountInfo[] = await app.getTokenCache().getAllAccounts();
    const account = accounts.find((item) => item.homeAccountId === accountId);
    if (!account) throw new Error("ไม่พบบัญชีที่เชื่อมต่อ");
    try {
      const result = await app.acquireTokenSilent({ account, scopes: SCOPES });
      if (!result?.accessToken) throw new Error("ไม่พบ Access Token");
      return result.accessToken;
    } catch {
      throw new Error("สิทธิ์เข้าถึงบัญชีหมดอายุ กรุณาตัดการเชื่อมต่อแล้วเชื่อมใหม่");
    }
  });
}

export async function disconnectAccount(accountId: string) {
  return withMsal(async (app) => {
    const account = (await app.getTokenCache().getAllAccounts()).find((item) => item.homeAccountId === accountId);
    if (!account) return false;
    await app.getTokenCache().removeAccount(account);
    return true;
  });
}

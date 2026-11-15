import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_FOLDER = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_FOLDER, "msal-cache.enc");

function getKey() {
  const raw = process.env.STORAGE_ENCRYPTION_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw)) throw new Error("Missing STORAGE_ENCRYPTION_KEY");
  return Buffer.from(raw, "hex");
}

export async function readEncryptedCache() {
  let raw: string;
  try {
    raw = await readFile(DATA_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
  const { iv, tag, data } = JSON.parse(raw) as { iv: string; tag: string; data: string };
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export async function writeEncryptedCache(cleartext: string) {
  await mkdir(DATA_FOLDER, { recursive: true, mode: 0o700 });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(cleartext, "utf8"), cipher.final()]);
  const value = JSON.stringify({
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
  await writeFile(DATA_FILE, value, { mode: 0o600 });
}

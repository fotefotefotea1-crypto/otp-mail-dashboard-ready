import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  console.log("\nมีไฟล์ .env.local อยู่แล้ว เพื่อความปลอดภัยจะไม่เขียนทับ\n");
  process.exit(0);
}

const rl = readline.createInterface({ input, output });
console.log("\n=== ตั้งค่ารหัสผ่านเข้า OTP Mail Dashboard ===");
console.log("ใช้เฉพาะสำหรับเข้าเว็บไซต์ของคุณ ไม่ใช่รหัสผ่าน Outlook");
console.log("หมายเหตุ: ตัวอักษรที่พิมพ์จะแสดงในหน้าต่าง Terminal\n");
const password = await rl.question("ตั้งรหัสผ่านเข้าเว็บ (12 ตัวอักษรขึ้นไป): ");
if (password.length < 12) {
  console.error("\nรหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร กรุณารัน npm run setup อีกครั้ง");
  rl.close();
  process.exit(1);
}
const confirm = await rl.question("พิมพ์รหัสผ่านเดิมอีกครั้ง: ");
rl.close();
if (password !== confirm) {
  console.error("\nรหัสผ่านไม่ตรงกัน กรุณารัน npm run setup อีกครั้ง");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const passwordHash = scryptSync(password, salt, 64).toString("hex");
const env = [
  "# สร้างโดย npm run setup — ห้ามแชร์ไฟล์นี้",
  "APP_URL=http://localhost:3000",
  `OWNER_PASSWORD_HASH=scrypt:${salt}:${passwordHash}`,
  `SESSION_SECRET=${randomBytes(32).toString("hex")}`,
  `STORAGE_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
  "MICROSOFT_CLIENT_ID=",
  "MICROSOFT_CLIENT_SECRET=",
  "",
].join("\n");
writeFileSync(envPath, env, { mode: 0o600, flag: "wx" });
console.log("\n✅ ตั้งค่าสำเร็จ! ไฟล์ .env.local ถูกสร้างแล้ว");
console.log("ต่อไปพิมพ์: npm run dev\n");

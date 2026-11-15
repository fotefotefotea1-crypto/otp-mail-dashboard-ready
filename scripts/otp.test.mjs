import test from "node:test";
import assert from "node:assert/strict";
import { detectOtp, extractOtps, extractVerificationLinks, plainText } from "../src/lib/otp.mjs";

test("reads four digits from OTP", () => {
  assert.equal(detectOtp("Your OTP", "Your OTP is 7394"), "7394");
});
test("reads six digits from security email", () => {
  assert.equal(detectOtp("Security code", "Your security code is 123456"), "123456");
});
test("reads Thai OTP", () => {
  assert.equal(detectOtp("รหัสยืนยัน", "รหัสยืนยันของคุณคือ 654321"), "654321");
});
test("does not classify random numbers as OTP", () => {
  assert.equal(detectOtp("Your order #123456", "Total 90000 THB"), null);
});
test("strips HTML and scripts", () => {
  assert.equal(plainText("<style>x{color:red}</style><p>OTP: <b>1234</b></p>"), "OTP: 1234");
});
test("omits messages older than 48 hours", () => {
  assert.equal(extractOtps([{id:"1", subject:"Your OTP", bodyPreview:"OTP is 123456",receivedDateTime:"2020-01-01T00:00:00Z"}]).length, 0);
});

test("extracts verification button URLs from HTML", () => {
  const links=extractVerificationLinks('<a href="https://example.com/verify?t=abc&amp;x=1"><span>อนุญาตให้เข้าสู่ระบบ</span></a>', 'Sign in');
  assert.equal(links[0].url, 'https://example.com/verify?t=abc&x=1');
});
test("rejects javascript links", () => {
  assert.equal(extractVerificationLinks('<a href="javascript:alert(1)">Verify</a>').length,0);
});
test('finds OTP when code precedes Thai explanatory text',()=>{assert.equal(detectOtp('ยืนยันตัวตน','4821 คือรหัสยืนยันของคุณ'), '4821');});
test('finds OTP in HTML email',()=>{assert.equal(detectOtp('Netflix sign in', '<div>รหัสของคุณ</div><strong>6248</strong>'), '6248');});
test('ignores unrelated dates in email with code',()=>{assert.equal(detectOtp('รหัสยืนยัน','วันที่ 2026-11-15 รหัส OTP ของคุณ: 4932'), '4932');});

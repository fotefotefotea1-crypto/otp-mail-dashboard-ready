"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Check, ChevronDown, Copy, Inbox,
  LoaderCircle, Mail, Menu, Plus, RefreshCw, Search, ShieldCheck, X,
} from "lucide-react";

type Account = { id: string; email: string; provider?: string };
type VerifyLink = { url: string; label: string; host: string };
type Message = {
  id: string;
  code: string | null;
  links?: VerifyLink[];
  sender: string;
  senderEmail?: string;
  subject: string;
  receivedAt: string;
};
type ReadState = "idle" | "loading" | "done" | "error";

function accountType(email: string): "Outlook" | "Hotmail" {
  return email.toLowerCase().endsWith("@hotmail.com") ? "Hotmail" : "Outlook";
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "ไม่ทราบเวลา";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [type, setType] = useState("all");
  const [activeAccount, setActiveAccount] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [scanned, setScanned] = useState(0);
  const [readState, setReadState] = useState<ReadState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const abort = useRef<AbortController | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const response = await fetch("/api/accounts", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดบัญชีได้");
      setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
      setConfigured(Boolean(payload.microsoftConfigured));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถโหลดบัญชีได้");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("result");
    if (result === "connected") setNotice("เพิ่มบัญชี Outlook / Hotmail สำเร็จแล้ว");
    if (result === "connection-error") setError("เชื่อมต่อ Microsoft ไม่สำเร็จ ตรวจสอบ Client ID, Client Secret และ Redirect URI");
    if (result) {
      params.delete("result");
      window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    }
  }, []);
  useEffect(() => () => abort.current?.abort(), []);

  const filtered = useMemo(() => accounts.filter((account) =>
    account.email.toLowerCase().includes(query.trim().toLowerCase()) &&
    (type === "all" || accountType(account.email).toLowerCase() === type)
  ), [accounts, query, type]);
  const activeEmail = accounts.find((a) => a.id === activeAccount)?.email || "";
  // Show only OTP-bearing messages. Verification-link extraction remains on the server
  // for a future iteration, but this page never renders or opens those links.
  const latestOtp = useMemo(() => messages
    .filter((m) => typeof m.code === "string" && /^\d{4,6}$/.test(m.code))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())[0] ?? null, [messages]);

  async function connect() {
    if (!configured) { setError("ยังไม่ได้ตั้งค่า MICROSOFT_CLIENT_ID และ MICROSOFT_CLIENT_SECRET ใน .env.local"); return; }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/auth/microsoft/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "เริ่มเชื่อมต่อ Microsoft ไม่สำเร็จ");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อ Microsoft ไม่สำเร็จ");
      setAdding(false);
    }
  }

  async function readMail(account: Account) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setActiveAccount(account.id);
    setReadState("loading");
    setMessages([]);
    setDetailsOpen(false);
    setScanned(0);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/otps?accountId=${encodeURIComponent(account.id)}`, {
        cache: "no-store", signal: controller.signal,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "อ่านอีเมลไม่สำเร็จ");
      if (controller.signal.aborted) return;
      setMessages(Array.isArray(result.items) ? result.items : []);
      setScanned(Number(result.scanned) || 0);
      setReadState("done");
    } catch (e) {
      if (controller.signal.aborted) return;
      setReadState("error");
      setError(e instanceof Error ? e.message : "อ่านอีเมลไม่สำเร็จ");
    }
  }

  async function copyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(""), 2000);
    } catch { setError("คัดลอกไม่สำเร็จ กรุณาคัดลอกรหัสด้วยตนเอง"); }
  }



  return (
    <div className="shell ui-compact">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Mail size={20}/></span><div><strong>OTP Mail</strong><small>Dashboard</small></div></div>
        <div className="side-caption">เมนูจัดการ</div>
        <nav aria-label="เมนูหลัก"><div className="side-active"><Inbox size={17}/> ทดสอบดึงเมล</div></nav>
      </aside>
      {mobileMenu && <button className="mobile-shade" aria-label="ปิดเมนู" onClick={() => setMobileMenu(false)}/>}
      <div className="main-area">
        <header className="header">
          <div className="header-left"><button className="menu-toggle" aria-label="เปิดเมนู" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X size={20}/> : <Menu size={20}/>}</button><span>ทดสอบดึงเมล</span></div>
          <div className="header-right"><span className="header-indicator"/><span>OTP Dashboard</span></div>
        </header>
        <main className="content">
          <div className="page-title"><div><h1>ทดสอบดึงเมล</h1><p>เลือกบัญชีอีเมล แล้วกดดึงเมลล่าสุดเพื่อดูรหัส OTP</p></div>

          </div>
          {error && <div className="alert" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => setError("")} aria-label="ปิดข้อผิดพลาด"><X size={16}/></button></div>}
          {notice && <div className="notice" role="status"><Check size={17}/>{notice}<button onClick={() => setNotice("")} aria-label="ปิดข้อความ"><X size={15}/></button></div>}
          <section className="account-table-wrap" aria-label="รายการบัญชีทดสอบ">
            <div className="table-toolbar">
              <div className="table-heading"><strong>รายการบัญชีสำหรับทดสอบ</strong><small>บัญชี Outlook / Hotmail ที่เชื่อมต่อแล้ว</small></div>
              <div className="toolbar-actions"><label className="search-input"><Search size={15}/><input placeholder="ค้นหาอีเมล..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="ค้นหาบัญชีอีเมล"/></label>
                <label className="filter-select"><select aria-label="ชนิดเมล" value={type} onChange={(e) => setType(e.target.value)}><option value="all">ชนิดเมล: ทั้งหมด</option><option value="outlook">Outlook</option><option value="hotmail">Hotmail</option></select><ChevronDown size={14}/></label>
                <span className="account-count">{filtered.length} / {accounts.length} บัญชี</span>
                <button className="add-btn" disabled={adding} onClick={() => void connect()}><Plus size={15}/>{adding ? "กำลังเชื่อม..." : "เพิ่ม Outlook"}</button>
              </div>
            </div>
            <div className="table-scroll"><table className="account-table"><thead><tr><th>#</th><th>อีเมล</th><th>สถานะ TOKEN</th><th>ผลการดึง OTP</th><th>จัดการ</th></tr></thead><tbody>
              {filtered.map((account, index) => {
                const isActive = account.id === activeAccount;
                const hasOtp = Boolean(latestOtp);
                const resultText = isActive && readState === "done" ? (hasOtp ? latestOtp!.code! : "ไม่พบ OTP") : isActive && readState === "error" ? "อ่านเมลไม่สำเร็จ" : isActive && readState === "loading" ? "กำลังตรวจสอบ..." : "ยังไม่ทดสอบ";
                return <tr key={account.id} className={isActive ? "active-row" : ""}><td className="row-number">{index + 1}</td><td><div className="email-cell"><span className="email-dot"/><strong>{account.email}</strong><span className="provider-tag">{accountType(account.email)}</span></div></td><td><span className="token-status"><span/> เชื่อมแล้ว</span></td><td><span className={isActive && readState === "done" && hasOtp ? "found-result otp-inline" : "result-status"}>{resultText}</span></td><td className="action-cell">{isActive && readState === "done" && hasOtp && <button type="button" className="details-button" onClick={() => setDetailsOpen(true)}>ดูรายละเอียด</button>}<button className="fetch-button" disabled={readState === "loading"} onClick={() => void readMail(account)}>{isActive && readState === "loading" ? <LoaderCircle className="spin" size={15}/> : <Mail size={15}/>} {isActive && readState === "loading" ? "กำลังดึง..." : "ดึงเมลล่าสุด"}</button></td></tr>;
              })}
              {!loadingAccounts && filtered.length === 0 && <tr><td colSpan={5}><div className="table-empty"><Inbox size={21}/><strong>{accounts.length ? "ไม่พบบัญชีที่ค้นหา" : "ยังไม่มีบัญชีอีเมลที่เชื่อมต่อ"}</strong><span>{accounts.length ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "กดปุ่มเพิ่ม Outlook เพื่อเชื่อมบัญชีของคุณ"}</span></div></td></tr>}
              {loadingAccounts && <tr><td colSpan={5}><div className="table-empty"><LoaderCircle className="spin" size={20}/>กำลังโหลดบัญชี...</div></td></tr>}
            </tbody></table></div>
          </section>
          {detailsOpen && latestOtp && readState === "done" && <div className="otp-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailsOpen(false); }}>
            <section className="otp-modal" role="dialog" aria-modal="true" aria-label="รายละเอียดรหัส OTP">
              <div className="otp-modal-header"><span><Mail size={17}/> {activeEmail}</span><button className="otp-modal-close" onClick={() => setDetailsOpen(false)} aria-label="ปิดหน้าต่าง"><X size={18}/></button></div>
              <div className="otp-modal-body"><div className="otp-modal-label">หัวข้ออีเมล</div><strong className="otp-modal-subject">{latestOtp.subject}</strong>
                <div className="otp-modal-code"><div className="otp-modal-code-top"><span><ShieldCheck size={16}/> รหัส OTP ที่ตรวจพบ</span><button className="copy-button" onClick={() => void copyCode(latestOtp.code!, latestOtp.id)}>{copiedId === latestOtp.id ? <Check size={14}/> : <Copy size={14}/>} {copiedId === latestOtp.id ? "คัดลอกแล้ว" : "คัดลอก"}</button></div><strong>{latestOtp.code}</strong></div>
                <div className="otp-modal-meta"><span>ผู้ส่ง</span><strong>{latestOtp.senderEmail || latestOtp.sender}</strong></div>
                <div className="otp-modal-meta"><span>เวลาที่ได้รับ</span><strong>{formatDate(latestOtp.receivedAt)}</strong></div>
              </div>
            </section>
          </div>}
          <footer className="footer"><ShieldCheck size={14}/> อ่านเฉพาะบัญชีที่เลือก · แสดงเฉพาะรหัส OTP 4–6 หลัก</footer>
        </main>
      </div>
    </div>
  );
}

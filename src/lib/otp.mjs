/** Parse verification emails. Never persist OTP values. */
const HINT = /otp|one[\s-]?time|verif(?:y|ication)|confirm(?:ation)?|security|sign[\s-]?in|log[\s-]?in|passcode|authentication|access code|รหัส|ยืนยัน|เข้าสู่ระบบ|ความปลอดภัย|อนุญาต|ตัวเลข|code|pin/i;
const STRONG = /otp|one[\s-]?time|verif(?:y|ication)|security\s*code|sign[\s-]?in\s*code|log[\s-]?in\s*code|passcode|authentication\s*code|รหัส|ยืนยัน|รหัสผ่านครั้งเดียว|code/i;
const CODE = /(?<!\d)(\d{4,6})(?!\d)/g;
const decode = (s) => String(s || '').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,h,d)=>{const n=parseInt(h||d,h?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';});
export function plainText(value) {
  return decode(String(value||'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/https?:\/\/\S+/g,' ').replace(/\s+/g,' ')).trim();
}
export function detectOtp(subject, body) {
  const subj = plainText(subject), text = `${subj} ${plainText(body)}`.slice(0,30000);
  if (!HINT.test(text)) return null;
  const matches = [...text.matchAll(CODE)];
  if (!matches.length) return null;
  const ranked = matches.map(m=>{
    const i=m.index||0, before=text.slice(Math.max(0,i-110),i), after=text.slice(i+m[0].length,i+m[0].length+80);
    const local=before.slice(-75)+' '+after.slice(0,55);
    let score=0;
    if (STRONG.test(before.slice(-65))) score+=6;
    if (STRONG.test(after.slice(0,55))) score+=5;
    if (/^(?:\s|:|-|คือ|is|=)*$/i.test(before.slice(-12))) score+=1;
    if (/\b(?:19|20)\d{2}\b/.test(m[0]) && /date|year|ปี|วันที่/i.test(local)) score-=6;
    if (/order|invoice|tracking|ยอด|ราคา|บาท|amount|โทร|phone|ticket/i.test(local) && !STRONG.test(local)) score-=5;
    return {code:m[0],score,index:i};
  }).sort((a,b)=>b.score-a.score||a.index-b.index);
  if (ranked[0].score>=5) return ranked[0].code;
  const unique=[...new Set(matches.map(m=>m[0]))];
  if (STRONG.test(subj) && unique.length===1) return unique[0];
  return null;
}
export function extractVerificationLinks(html='',subject='') {
  const candidates=[];
  const relevant=/verify|confirm|approv|authoriz|allow|sign.?in|log.?in|activat|ยืนยัน|อนุญาต|เข้าสู่ระบบ|เปิดใช้งาน|ตรวจสอบตัวตน|continue|ดำเนินการต่อ/i;
  for(const m of String(html).matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi)) {
    const attr=m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if(!attr) continue;
    const href=decode(attr[1]||attr[2]||attr[3]);
    const label=plainText(m[2]).slice(0,100);
    try {
      const url=new URL(href);
      if(url.protocol!=='https:' || url.username || url.password) continue;
      if(!relevant.test(label+' '+subject+' '+url.pathname)) continue;
      if(!candidates.some(x=>x.url===url.href)) candidates.push({url:url.href,label:label||'เปิดลิงก์ยืนยัน',host:url.hostname});
    } catch {}
    if(candidates.length>=5) break;
  }
  return candidates;
}
export function extractOtps(messages) {
  const cutoff=Date.now()-7*24*60*60*1000;
  return messages.filter(m=>{
    const time=Date.parse(m.receivedDateTime||'');return Number.isFinite(time)&&time>=cutoff&&time<Date.now()+300000;
  }).map(m=>{
    const body=m.body?.content||m.bodyPreview||'';
    const code=detectOtp(m.subject||'',body)||detectOtp(m.subject||'',m.bodyPreview||'');
    const links=extractVerificationLinks(body,m.subject||'');
    if(!code&&!links.length)return null;
    return {id:m.id,code,links,sender:m.from?.emailAddress?.name||m.from?.emailAddress?.address||'ไม่ทราบผู้ส่ง',senderEmail:m.from?.emailAddress?.address||'',subject:(m.subject||'(ไม่มีหัวข้อ)').slice(0,180),receivedAt:m.receivedDateTime};
  }).filter(Boolean).slice(0,40);
}

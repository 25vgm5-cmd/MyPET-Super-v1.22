"use strict";
/* ================= SECTION 2: PURE CALCULATIONS (integer cents) ================= */
// PURE-START
function parseCents(str){
  const s=String(str==null?"":str).trim().replace(/\s/g,"");
  if(!/^\d+([.,]\d{1,2})?$/.test(s))return null;
  const p=s.replace(",",".").split(".");
  const cents=parseInt(p[0],10)*100+(p[1]?parseInt((p[1]+"0").slice(0,2),10):0);
  if(!Number.isSafeInteger(cents)||cents<=0)return null;
  return cents;
}
function fmtMoney(c){
  const neg=c<0,a=Math.abs(c);
  const i=String(Math.floor(a/100)).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return (neg?"-":"")+i+"."+String(a%100).padStart(2,"0")+" €";
}
function isValidDate(s){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||"");
  if(!m)return false;
  const y=+m[1],mo=+m[2],d=+m[3];
  if(y<1900||y>2100||mo<1||mo>12||d<1)return false;
  const dim=[31,(y%4===0&&y%100!==0)||y%400===0?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];
  return d<=dim;
}
function fmtDate(s){return s?s.slice(8,10)+"-"+s.slice(5,7)+"-"+s.slice(0,4):""}
function todayISO(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function sumTx(txs,from,to){
  let inc=0,exp=0;
  for(const t of txs){
    if(from&&t.date<from)continue;
    if(to&&t.date>to)continue;
    if(t.type==="income")inc+=t.cents;else exp+=t.cents;
  }
  return{income:inc,expense:exp,net:inc-exp};
}
function monthRange(ym){ // ym = "YYYY-MM" -> inclusive ISO bounds (string compare is safe for ISO dates)
  return{from:ym+"-01",to:ym+"-31"};
}
function expenseByCategory(txs,from,to){
  const m={};
  for(const t of txs){
    if(t.type!=="expense")continue;
    if(from&&t.date<from)continue;
    if(to&&t.date>to)continue;
    m[t.category]=(m[t.category]||0)+t.cents;
  }
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function finalBalance(opening,txs){const s=sumTx(txs);return opening+s.income-s.expense}
function monthlyBreakdown(txs,year){ // 12 entries (Jan..Dec) of integer-cent totals
  const a=Array.from({length:12},()=>({income:0,expense:0}));
  for(const x of txs){
    if(x.date.slice(0,4)!==String(year))continue;
    const m=+x.date.slice(5,7)-1;
    if(x.type==="income")a[m].income+=x.cents;else a[m].expense+=x.cents;
  }
  return a;
}
function balanceUpTo(opening,txs,toDate){ // opening + all income - all expenses dated on/before toDate
  let b=opening;
  for(const x of txs){if(x.date>toDate)continue;b+=x.type==="income"?x.cents:-x.cents}
  return b;
}
function centsToDecimal(c){const neg=c<0,a=Math.abs(c);return (neg?"-":"")+Math.floor(a/100)+"."+String(a%100).padStart(2,"0")}
function csvCell(v){ // quotes fields; neutralises spreadsheet formula injection in text
  let s=String(v==null?"":v);
  if(/^[=+\-@\t\r]/.test(s))s="'"+s;
  return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
// PURE-END


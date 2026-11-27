"use strict";
/* ================= SECTION 2C: PDF STATEMENT PARSING (no DOM) ================= */
// PDF-START
// Layout-agnostic heuristics. Nothing here is trusted blindly: every row goes to a preview the user must confirm.
const MONTH_RE=/^(jan(uary|vier)?|feb(ruary)?|fev(rier)?|mar(ch|s)?|apr(il)?|avr(il)?|may|mai|jun(e)?|juin|jul(y)?|juil(let)?|aug(ust)?|aou(t)?|sep(t(ember|embre)?)?|oct(ober|obre)?|nov(ember|embre)?|dec(ember|embre)?)$/;
function monthNum(w){
  const s=w.toLowerCase().normalize("NFD").replace(/[̀-ͯ.]/g,"");
  if(!MONTH_RE.test(s))return null;
  if(s.startsWith("juin"))return 6;if(s.startsWith("juil"))return 7;
  return({jan:1,feb:2,fev:2,mar:3,apr:4,avr:4,may:5,mai:5,jun:6,jul:7,aug:8,aou:8,sep:9,oct:10,nov:11,dec:12})[s.slice(0,3)]||null;
}
function parseDateAtStart(s){ // -> {y|null,mo,d,len} or null
  let m;const out=(y,mo,d,len)=>({y,mo:+mo,d:+d,len});
  const full=(y,mo,d,len)=>isValidDate(y+"-"+String(mo).padStart(2,"0")+"-"+String(d).padStart(2,"0"))?out(+y,mo,d,len):null;
  if((m=/^\s*(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(s)))return full(m[1],m[2],m[3],m[0].length);
  if((m=/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/.exec(s)))return full(m[3].length===2?2000+(+m[3]):+m[3],m[2],m[1],m[0].length);
  if((m=/^\s*(\d{1,2})[ \t ]+([A-Za-zÀ-ÿ.]{3,10})[ \t ]+(\d{4}|\d{2})(?!\d)/.exec(s))){
    const mo=monthNum(m[2]);if(mo)return full(m[3].length===2?2000+(+m[3]):+m[3],mo,m[1],m[0].length);
  }
  if((m=/^\s*(\d{1,2})[ \t ]+([A-Za-zÀ-ÿ.]{3,10})(?![A-Za-zÀ-ÿ\d])/.exec(s))){
    const mo=monthNum(m[2]);if(mo&&+m[1]>=1&&+m[1]<=31)return out(null,mo,m[1],m[0].length);
  }
  if((m=/^\s*(\d{2})[\/.](\d{2})(?![\d\/.\-])/.exec(s))){
    const d=+m[1],mo=+m[2];if(mo>=1&&mo<=12&&d>=1&&d<=31)return out(null,mo,d,m[0].length);
  }
  return null;
}
const AMT_RE=/([-+−–]?)\s?(?:€\s?)?(\d{1,3}(?:[   .,']\d{3})+[.,]\d{2}|\d+[.,]\d{2})(?!\d)(?:\s?(CR|DR|EUR|€)(?![A-Za-z])|(-)(?![\w]))?/gi;
function amountToCents(core){
  const c=core.replace(/[   ']/g,""),i=Math.max(c.lastIndexOf("."),c.lastIndexOf(","));
  return parseInt(c.slice(0,i).replace(/[.,]/g,""),10)*100+parseInt(c.slice(i+1),10);
}
function findAmounts(s){ // monetary tokens with exactly 2 decimals; sign: -1/+1/0
  const out=[];AMT_RE.lastIndex=0;let m;
  while((m=AMT_RE.exec(s))){
    if(m.index>0&&/[\d.,\/]/.test(s[m.index-1]))continue; // glued to a longer number/date
    let sign=0;
    if(m[1]&&m[1]!=="+")sign=-1;else if(m[1]==="+")sign=1;
    const ind=m[3]&&m[3].toUpperCase();
    if(ind==="DR"||m[4]==="-")sign=-1;else if(ind==="CR")sign=1;
    out.push({start:m.index,end:m.index+m[0].length,cents:amountToCents(m[2]),sign});
  }
  return out;
}
function pdfItemsToLines(items){ // items [{str,x,y,w,h}] of one page -> lines top-to-bottom, each with cells left-to-right
  const its=items.filter(i=>i.str&&i.str.trim()!=="").sort((a,b)=>b.y-a.y||a.x-b.x);
  const lines=[];
  for(const it of its){
    const h=it.h||10;let L=lines[lines.length-1];
    if(!L||Math.abs(L.y-it.y)>Math.max(2,h*0.45)){L={y:it.y,h,items:[]};lines.push(L)}
    L.items.push(it);
  }
  return lines.map(L=>{
    L.items.sort((a,b)=>a.x-b.x);
    const cells=[];
    for(const it of L.items){
      const c=cells[cells.length-1],gap=c?it.x-c.x1:0,h=it.h||10;
      if(c&&gap<h*0.6){c.s+=(gap>h*0.12?" ":"")+it.str;c.x1=Math.max(c.x1,it.x+it.w)}
      else cells.push({s:it.str,x0:it.x,x1:it.x+it.w});
    }
    return{y:L.y,h:L.h,cells};
  });
}
const COLS_RE={debit:/d[eé]bit|withdraw|money out|paid out|retrait|sortie/i,credit:/cr[eé]dit|deposit|money in|paid in|d[eé]p[oô]t|entr[eé]e|payments? in/i,balance:/balance|solde/i,amount:/^(amount|montant)/i};
function headerCols(cells){ // column positions if the line is a table header, else null
  const cols=[];
  for(const c of cells){
    const k=["debit","credit","balance","amount"].find(k=>COLS_RE[k].test(c.s.trim()));
    if(k&&c.s.trim().length<=24)cols.push({kind:k,x0:c.x0,x1:c.x1,xc:(c.x0+c.x1)/2});
  }
  const kinds=new Set(cols.map(c=>c.kind));
  const ok=(kinds.has("debit")&&kinds.has("credit"))||(kinds.size>=2&&(kinds.has("amount")||kinds.has("debit")||kinds.has("credit"))&&kinds.has("balance"));
  return ok?cols:null;
}
function nearestCol(cols,a){
  let best=null,bd=1e9;
  for(const c of cols){const d=Math.min(Math.abs(a.x1-c.x1),Math.abs(a.xc-c.xc),Math.abs(a.x0-c.x0));if(d<bd){bd=d;best=c}}
  return best;
}
function splitCells(cells){ // -> {desc, amts:[{cents,sign,x0,x1,xc}]} ; only amounts at the END of a cell count (mid-text numbers stay in the description)
  const amts=[],desc=[];
  for(const c of cells){
    const text=c.s,len=Math.max(1,text.length),found=findAmounts(text);
    let keep=[];
    for(let i=found.length-1;i>=0;i--){
      const a=found[i],tail=keep.length?text.slice(a.end,keep[0].start):text.slice(a.end);
      if(tail.trim()==="")keep.unshift(a);else break;
    }
    const cut=keep.length?keep[0].start:len;
    if(text.slice(0,cut).trim())desc.push(text.slice(0,cut).trim());
    for(const a of keep){
      const px=p=>c.x0+(p/len)*(c.x1-c.x0);
      amts.push({cents:a.cents,sign:a.sign,x0:px(a.start),x1:px(a.end),xc:(px(a.start)+px(a.end))/2});
    }
  }
  return{desc:desc.join(" ").replace(/\s+/g," ").trim(),amts};
}
const BAL_ROW_RE=/^(opening|closing|previous|new|old|brought forward|carried forward|balance|solde|ancien solde|nouveau solde|total)/i;
const FOOT_RE=/page|total|solde|balance|statement|relev[eé]|iban|bic\b|siret|www\.|@|continued|suite|registered|©/i;
function dayNum(iso){const p=iso.split("-").map(Number);return Math.round(Date.UTC(p[0],p[1]-1,p[2])/86400000)}
function isPossibleDuplicate(existing,row){
  if(!isValidDate(row.date)||!(row.cents>0))return false;
  const n=dayNum(row.date);
  return existing.some(x=>x.type===row.type&&x.cents===row.cents&&Math.abs(dayNum(x.date)-n)<=2);
}
const OPEN_RE=/^(ancien solde|solde pr[eé]c[eé]dent|solde initial|opening balance|previous balance|balance brought forward|brought forward)/i;
const CLOSE_RE=/^(nouveau solde|solde final|solde de cl[oô]ture|closing balance|new balance|balance carried forward|carried forward)/i;
const CUT_RE=/\s+(?:(?:REF|REFERENCE|R[eé]f[eé]rence|IDENT|MANDAT|DATE DE VALEUR|CARTE NUMERO)\b|COMPTE\s+FR\d|\d{8,})/i;
function shortDesc(full){ // keep the readable start of a bank description; the long reference part goes to Notes
  const m=CUT_RE.exec(full),s=(m?full.slice(0,m.index):full).replace(/\s+/g," ").trim();
  return (s||full).slice(0,120);
}
const CAT_RULES={expense:[
  [/\b(SFR|BOUYGUES|ORANGE|FREE MOBILE|SOSH)\b|T[EÉ]L[EÉ]PH/i,"Telephone"],[/FREEBOX|LIVEBOX|INTERNET/i,"Internet"],
  [/\b(EDF|ENGIE|GAZ|EAU)\b|LOYER|IMMOBILIERE/i,"Housing"],[/MACIF|MUTUELLE|MUTAVIE|ASSURANCE|\b(AXA|MAIF)\b|GROUPAMA|COTISATIONS? SANT/i,"Insurance"],
  [/CARREFOUR|LECLERC|SUBAN|NAZAR|LECLERC|H MARKET|AUCHAN|\bLIDL\b|MONOPRIX|SUPERMARCH|BOULANGERIE|RESTAURANT|\bFOOD\b/i,"Food"],
  [/SNCF|RATP|NAVIGO|ESSENCE|PETROLE|TOTAL|ESSO|NETTO|PEAGE|\bUBER\b|PARKING/i,"Transport"],[/PHARMACIE|M[EÉ]DECIN|DOCTEUR|DENTISTE|H[OÔ]PITAL|CPAM/i,"Healthcare"],
  [/PENSION|ALIMENTAIRE|MLE.ANITA|ANITA/i,"Education"],
  [/ACHAT CB|AMAZON|\bFNAC\b|DECATHLON/i,"Shopping"]],
  income:[[/SALAIRE|ANSAMBLE|PAIE|SALARY|\bPAIE\b/i,"Salary"]]};
function suggestCategoryName(type,desc,names){ // only a starting suggestion: the user can change it in the preview
  for(const [re,n] of CAT_RULES[type]||[])if(re.test(desc)&&names.includes(n))return n;
  const d=type==="income"?"Other Income":"Other Expenses";
  return names.includes(d)?d:(names[0]||"");
}
function guessMethod(desc){
  if(/PR[EÉ]L[EÈ]VEMENT|\bPRLV\b|DIRECT DEBIT/i.test(desc))return "Direct Debit";
  if(/\bCB\b|CARTE|\bCARD\b/i.test(desc))return "Card";
  if(/VIREMENT|\bVIR\b|TRANSFER/i.test(desc))return "Bank Transfer";
  return "Other";
}
function parseStatementLines(lines,fallbackYear){
  const pad=n=>String(n).padStart(2,"0");
  // statement year: most common explicit 4-digit-year date, else first 20xx mentioned, else fallback (guessed)
  const yc={},explicit=[];let guessedYear=false,docYear=null,m;
  for(const L of lines){
    const txt=L.cells.map(c=>c.s).join(" ");
    const re=/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b|\b(20\d{2})-(\d{2})-(\d{2})\b/g;
    while((m=re.exec(txt))){
      const y=m[3]||m[4],mo=m[3]?m[2]:m[5],d=m[3]?m[1]:m[6],s=y+"-"+pad(+mo)+"-"+pad(+d);
      if(isValidDate(s)){yc[y]=(yc[y]||0)+1;explicit.push(s)}
    }
  }
  const ys=Object.keys(yc).sort((a,b)=>yc[b]-yc[a]);
  if(ys.length)docYear=+ys[0];
  else{for(const L of lines){const mm=/\b(20\d{2})\b/.exec(L.cells.map(c=>c.s).join(" "));if(mm){docYear=+mm[1];break}}
    if(!docYear){docYear=fallbackYear||new Date().getFullYear()}guessedYear=true;}
  // latest explicit date of that year = end of the statement period; later year-less dates belong to the year before
  const anchor=explicit.filter(s=>+s.slice(0,4)===docYear).sort().pop()||null;
  const rows=[],events=[];let cols=null,prev=null,skipped=0;
  for(const L of lines){
    const hc=headerCols(L.cells);
    if(hc){cols=hc;prev=null;continue}
    const joined=L.cells.map(c=>c.s).join(" ").trim();
    const isOpen=OPEN_RE.test(joined),isClose=!isOpen&&CLOSE_RE.test(joined);
    if(isOpen||isClose){ // opening/closing balance lines: used only to verify the extracted rows
      const am=splitCells(L.cells).amts,a=am[am.length-1];
      if(a)events.push({kind:isOpen?"open":"close",val:a.sign<0?-a.cents:a.cents,at:rows.length});
      prev=null;continue;
    }
    const text=L.cells.map(c=>c.s).join("\t");
    let d=parseDateAtStart(text);
    if(!d){
      if(!prev)continue;
      const {desc,amts}=splitCells(L.cells);
      if(amts.length&&!prev.amts.length&&!FOOT_RE.test(desc)){prev.amts=amts;prev.cols=cols;if(desc)prev.desc+=" "+desc;prev.lastY=L.y;continue}
      if(!amts.length&&desc&&prev.cont<4&&L.page===prev.page&&prev.lastY-L.y<=Math.max(L.h,prev.h)*2.6&&!FOOT_RE.test(desc)&&desc.length<=200){prev.desc+=" "+desc;prev.cont++;prev.lastY=L.y}
      continue;
    }
    // rest of the line after the date (and an optional second/value date)
    let consumed=d.len;const d2=parseDateAtStart(text.slice(consumed));
    if(d2&&/^[\s\t]/.test(text.slice(consumed)))consumed+=d2.len;
    const rest=[];let pos=0;
    for(let i=0;i<L.cells.length;i++){
      const c=L.cells[i],end=pos+c.s.length;
      if(end<=consumed){pos=end+1;continue}
      if(pos<consumed){const keep=c.s.slice(consumed-pos);rest.push({s:keep,x0:c.x0+(c.x1-c.x0)*((consumed-pos)/Math.max(1,c.s.length)),x1:c.x1})}
      else rest.push(c);
      pos=end+1;
    }
    const {desc,amts}=splitCells(rest);
    const row={d,desc,amts,cols,page:L.page,h:L.h,lastY:L.y,cont:0,idx:rows.length,balanceOnly:BAL_ROW_RE.test(desc)};
    rows.push(row);prev=row;
  }
  // ---- resolve amounts / balances / type
  const iso=r=>{
    let y=r.d.y;
    if(!y){y=docYear;if(anchor&&docYear+"-"+pad(r.d.mo)+"-"+pad(r.d.d)>anchor)y=docYear-1}
    const s=y+"-"+pad(r.d.mo)+"-"+pad(r.d.d);return isValidDate(s)?s:"";
  };
  rows.forEach(r=>{r.date=iso(r)});
  const dated=rows.filter(r=>r.date);
  const desc=dated.length>1&&dated[0].date>dated[dated.length-1].date; // newest first?
  const earlier=i=>rows[desc?i+1:i-1]; // chronologically earlier neighbour
  const lastSigned=r=>{const a=r.amts[r.amts.length-1];return a?(a.sign<0?-a.cents:a.cents):null};
  // headerless statements: do two amounts mean (amount, balance)? test against neighbouring balances
  let tests=0,hits=0;
  rows.forEach((r,i)=>{
    if(r.cols||r.amts.length<2||r.balanceOnly)return;const nb=earlier(i);if(!nb)return;
    const nbBal=nb.balanceOnly||(!nb.cols&&nb.amts.length>=2)?lastSigned(nb):null;if(nbBal===null)return;
    tests++;if(Math.abs(lastSigned(r)-nbBal)===r.amts[0].cents)hits++;
  });
  const headerlessBalance=tests>0&&hits/tests>=0.6;
  const out=[];
  rows.forEach(r=>{
    r.flags=[];r.cents=0;r.balance=null;r.type=null;let strong=false;
    if(r.balanceOnly){r.balance=lastSigned(r);return}
    if(!r.amts.length){skipped++;r.drop=true;return}
    if(r.cols){
      const by={debit:[],credit:[],amount:[],balance:[]};
      r.amts.forEach(a=>{const c=nearestCol(r.cols,a);if(c)by[c.kind].push(a)});
      if(by.balance.length)r.balance=by.balance[by.balance.length-1].sign<0?-by.balance[by.balance.length-1].cents:by.balance[by.balance.length-1].cents;
      if(by.debit.length&&by.credit.length){r.cents=by.debit[0].cents;r.type="expense";strong=true;r.flags.push("both")}
      else if(by.debit.length){r.cents=by.debit[0].cents;r.type="expense";strong=true}
      else if(by.credit.length){r.cents=by.credit[0].cents;r.type="income";strong=true}
      else if(by.amount.length){const a=by.amount[0];r.cents=a.cents;if(a.sign){r.type=a.sign<0?"expense":"income";strong=true}}
      else{r.balanceOnly=true;r.balance=r.balance;return}
    }else{
      let a=r.amts;
      if(a.length>=2&&headerlessBalance){r.balance=lastSigned(r);a=a.slice(0,a.length-1);if(a.length>1)r.flags.push("ambiguous")}
      else if(a.length>=2){r.flags.push("ambiguous")}
      r.cents=a[0].cents;if(a[0].sign){r.type=a[0].sign<0?"expense":"income";strong=true}
    }
    out.push(r);
  });
  rows.forEach((r,i)=>{ // balance arithmetic: the most reliable evidence for direction
    if(r.balanceOnly||r.drop||r.balance===null)return;const nb=earlier(i);
    if(!nb||nb.balance===null||nb.balance===undefined)return;
    const diff=r.balance-nb.balance;let dt=null;
    if(diff===r.cents)dt="income";else if(diff===-r.cents)dt="expense";
    if(dt&&!r.type)r.type=dt;else if(dt&&r.type&&r.type!==dt)r.flags.push("balance");
    else if(!dt)r.flags.push("balance");
  });
  const result=[];
  for(const r of out){
    if(!(r.cents>0))continue;
    if(!r.type){r.type="expense";r.flags.push("type")}
    if(r.d.y===null&&guessedYear)r.flags.push("year");
    if(!r.date)r.flags.push("date");
    const full=(r.desc||"").replace(/\s+/g," ").trim().slice(0,300);
    result.push({idx:r.idx,date:r.date,desc:shortDesc(full),full,type:r.type,cents:r.cents,balance:r.balance,flags:[...new Set(r.flags)],page:r.page,block:0});
  }
  // ---- sections (one per account block): a new "opening balance" that does not continue the previous block starts a new section
  const blocks=[{open:null,close:null,rows:[]}];let ei=0;
  const net=b=>b.rows.reduce((s,x)=>s+(x.type==="income"?x.cents:-x.cents),0);
  const applyEvents=upto=>{
    while(ei<events.length&&events[ei].at<=upto){
      const e=events[ei++],cur=blocks[blocks.length-1];
      if(e.kind==="open"){
        if(!cur.rows.length)cur.open=e.val;
        else if(cur.open!==null&&cur.open+net(cur)===e.val){/* continuation of the same account */}
        else blocks.push({open:e.val,close:null,rows:[]});
      }else cur.close=e.val;
    }
  };
  for(const x of result){applyEvents(x.idx);const cur=blocks[blocks.length-1];cur.rows.push(x);x.block=blocks.length-1}
  applyEvents(Infinity);
  const used=blocks.filter(b=>b.rows.length);
  const blockInfo=used.map((b,i)=>{
    b.rows.forEach(x=>{x.block=i});
    let inc=0,exp=0;for(const x of b.rows){if(x.type==="income")inc+=x.cents;else exp+=x.cents}
    let ok=null,diff=null;
    if(b.open!==null&&b.close!==null){diff=b.close-(b.open+inc-exp);ok=diff===0}
    return{open:b.open,close:b.close,income:inc,expense:exp,count:b.rows.length,ok,diff};
  });
  return{rows:result,docYear,skipped,blocks:blockInfo,yearInferred:result.some(x=>rows[x.idx].d.y===null),anchor};
}
// PDF-END


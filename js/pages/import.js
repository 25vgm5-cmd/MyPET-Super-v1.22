"use strict";
/* ---- Import PDF (Phase 4): PDF.js text extraction -> preview -> confirmed import ---- */
let pdfjsLib=null;
async function loadPdfJs(){ // locally bundled PDF.js (LIBRARY folder); never loaded from a CDN
  if(pdfjsLib)return pdfjsLib;
  let lib;
  try{lib=await import(new URL("LIBRARY/pdf.min.mjs",document.baseURI).href)}catch(e){throw new Error("PDFJS_MISSING")}
  lib.GlobalWorkerOptions.workerSrc=new URL("LIBRARY/pdf.worker.min.mjs",location.href).href;
  return pdfjsLib=lib;
}
async function extractPdfLines(file){
  const lib=await loadPdfJs();
  const data=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...data.subarray(0,5))!=="%PDF-")throw new Error("PDF_BAD");
  let doc;
  try{doc=await lib.getDocument({data,isEvalSupported:false,enableXfa:false}).promise}
  catch(e){throw new Error(e&&e.name==="PasswordException"?"PDF_PASSWORD":"PDF_BAD")}
  if(doc.numPages>100){try{await doc.destroy()}catch(e){}throw new Error("PDF_BIG")}
  const lines=[];let count=0;
  for(let p=1;p<=doc.numPages;p++){
    const tc=await (await doc.getPage(p)).getTextContent();
    const its=tc.items.filter(i=>typeof i.str==="string").map(i=>({str:i.str,x:i.transform[4],y:i.transform[5],w:i.width,h:i.height||Math.abs(i.transform[3])}));
    count+=its.length;
    pdfItemsToLines(its).forEach(l=>{l.page=p;lines.push(l)});
  }
  try{await doc.destroy()}catch(e){}
  if(!count)throw new Error("PDF_NO_TEXT");
  return lines;
}
function rowCents(x){return parseCents(x.amt)}
function rowDup(x){const c=rowCents(x);return c!==null&&isValidDate(x.date)&&isPossibleDuplicate(S.tx,{date:x.date,type:x.type,cents:c})}
function buildImp(r,name){
  const rows=r.rows.map((x,i)=>({id:i,sel:false,date:x.date,desc:x.desc,full:x.full,type:x.type,amt:centsToDecimal(x.cents),
    cat:suggestCategoryName(x.type,x.full,catsFor(x.type).map(c=>c.name)),method:guessMethod(x.full),flags:x.flags,block:x.block}));
  rows.forEach(x=>{x.sel=x.block===0&&!x.flags.length&&!rowDup(x)}); // only clean, non-duplicate rows of the first section start selected
  return{name,rows,blocks:r.blocks,skipped:r.skipped,yearInferred:r.yearInferred};
}
function viewImport(v){
  v.innerHTML=`<div class="panel"><h2>${esc(t("importTitle"))}</h2><p class="muted" style="font-size:13px">${esc(t("importInfo"))}</p>
   <input type="file" id="pf" accept="application/pdf,.pdf"><div id="pmsg"></div>
   <button class="btn pri" id="px" style="margin-top:10px">${esc(t("extract"))}</button></div><div id="pres"></div>`;
  $("px").onclick=extractClick;
  if(S.impNote){flash($("pmsg"),S.impNote,true);S.impNote=null}
  if(S.imp)drawImport();
}
async function extractClick(){
  const m=$("pmsg"),f=$("pf").files[0];
  if(!f)return flash(m,t("pickPdf"));
  if(f.size>30*1024*1024)return flash(m,t("errPdfBig"));
  if(S.busy)return;S.busy=true;
  $("px").disabled=true;flash(m,t("working"),true);S.imp=null;$("pres").innerHTML="";
  try{
    const lines=await extractPdfLines(f);
    const r=parseStatementLines(lines,new Date().getFullYear());
    if(!r.rows.length)throw new Error("PDF_NO_ROWS");
    S.imp=buildImp(r,f.name.slice(0,80));flash(m,"");drawImport();
  }catch(e){
    const k={PDFJS_MISSING:"errPdfLib",PDF_PASSWORD:"errPdfPw",PDF_BAD:"errPdfBad",PDF_BIG:"errPdfBig",PDF_NO_TEXT:"errPdfNoText",PDF_NO_ROWS:"errPdfNoRows"}[e.message];
    flash(m,k?t(k):t("errGeneric")+e.message);
  }
  S.busy=false;if($("px"))$("px").disabled=false;
}
const FLAG_KEY={type:"flagType",ambiguous:"flagAmb",balance:"flagBal",date:"flagDate",year:"flagYear",both:"flagBoth"};
function drawImport(){
  const I=S.imp,el=$("pres");if(!I||!el)return;
  const sel=I.rows.filter(x=>x.sel);let inc=0,exp=0;
  for(const x of sel){const c=rowCents(x);if(c===null)continue;if(x.type==="income")inc+=c;else exp+=c}
  const anyFlag=I.rows.some(x=>x.flags.length);
  let html=`<div class="msg ok" style="margin-top:14px">${I.rows.length} ${esc(t("foundRows"))}${I.skipped?` · ${I.skipped} ${esc(t("skippedRows"))}`:""}</div>`
   +(I.yearInferred?`<div class="msg err" style="font-size:13px">${esc(t("yearNote"))}</div>`:"")
   +(anyFlag?`<div class="msg err" style="font-size:13px">${esc(t("flagNote"))}</div>`:"")
   +`<div class="row noprint" style="margin-bottom:8px"><button class="btn sm" data-all="1">${esc(t("selAll"))}</button><button class="btn sm" data-all="0">${esc(t("selNone"))}</button></div>`;
  let last=-1;
  for(const x of I.rows){
    if(x.block!==last){
      last=x.block;const b=I.blocks[x.block];
      const rec=b.ok===true?`<span class="inc">✓ ${esc(t("reconOk"))}</span>`:b.ok===false?`<span class="exp">✗ ${esc(t("reconBad"))}: ${fmtMoney(b.diff)}</span>`:`<span class="muted">${esc(t("reconNone"))}</span>`;
      html+=`<div class="shead"><label class="chk"><input type="checkbox" data-sec="${x.block}" ${I.rows.filter(r=>r.block===x.block).every(r=>r.sel)?"checked":""}> <b>${esc(t("sectionN"))} ${x.block+1}</b> · ${b.count} · ${esc(t("totalIncome"))} ${fmtMoney(b.income)} · ${esc(t("totalExpenses"))} ${fmtMoney(b.expense)}</label>
       ${b.open!==null?`<div>${esc(t("opening"))} ${fmtMoney(b.open)} → ${esc(t("closingBal"))} ${b.close!==null?fmtMoney(b.close):"—"}</div>`:""}<div>${rec}</div></div>`;
    }
    const dup=rowDup(x),names=catsFor(x.type).map(c=>c.name);
    html+=`<div class="irow ${dup?"dup":""} ${x.sel?"":"off"}" data-i="${x.id}">
     <label class="chk"><input type="checkbox" data-f="sel" ${x.sel?"checked":""}> <span class="iamt ${x.type==="income"?"inc":"exp"}"><b>${x.type==="income"?"+":"−"}${esc(x.amt)} €</b></span>
      <span class="ibdg">${dup?`<span class="badge">${esc(t("dupBadge"))}</span>`:""}${x.flags.map(f=>`<span class="badge w">⚠ ${esc(t(FLAG_KEY[f]||f))}</span>`).join("")}</span></label>
     <div class="ifields">
      <div><label>${esc(t("date"))}</label>${dateInput('data-f="date"',x.date)}</div>
      <div><label>${esc(t("type"))}</label><select data-f="type"><option value="income" ${x.type==="income"?"selected":""}>${esc(t("income"))}</option><option value="expense" ${x.type==="expense"?"selected":""}>${esc(t("expense"))}</option></select></div>
      <div><label>${esc(t("amount"))}</label><input type="text" inputmode="decimal" data-f="amt" value="${esc(x.amt)}" autocomplete="off"></div>
      <div><label>${esc(t("category"))}</label><select data-f="cat">${names.map(n=>`<option value="${esc(n)}" ${n===x.cat?"selected":""}>${esc(catLabel(n))}</option>`).join("")}</select></div>
      <div class="wide"><label>${esc(t("description"))}</label><input type="text" data-f="desc" maxlength="120" value="${esc(x.desc)}" autocomplete="off"></div>
     </div></div>`;
  }
  html+=`<div class="sticky"><div id="imsg"></div><div id="isum" style="margin-bottom:8px"></div>
   <div class="row"><button class="btn pri" id="ib" ${sel.length?"":"disabled"}>${esc(t("importBtn"))}</button><button class="btn" id="id">${esc(t("discardPdf"))}</button></div></div>`;
  el.innerHTML=html;updateImportSum();
  el.querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>{I.rows.forEach(x=>x.sel=b.dataset.all==="1");drawImport()});
  el.querySelectorAll("[data-sec]").forEach(b=>b.onchange=()=>{I.rows.forEach(x=>{if(x.block===+b.dataset.sec)x.sel=b.checked});drawImport()});
  el.querySelectorAll(".irow [data-f]").forEach(inp=>{
    const x=I.rows[+inp.closest(".irow").dataset.i],f=inp.dataset.f;
    if(f==="desc")inp.oninput=()=>{x.desc=inp.value};
    else if(f==="amt"||f==="date"){ // update in place: rebuilding the list on blur would replace the Import button and swallow the next tap
      const val=()=>f==="date"?parseDMY(inp.value):inp.value.trim();
      inp.oninput=()=>{x[f]=val()};
      inp.onchange=()=>{x[f]=val();refreshImportRow(inp.closest(".irow"),x)};
    }else inp.onchange=()=>{
      if(f==="sel")x.sel=inp.checked;
      else if(f==="type"){x.type=inp.value;x.cat=suggestCategoryName(x.type,x.full,catsFor(x.type).map(c=>c.name))}
      else x[f]=inp.value.trim();
      drawImport();
    };
  });
  $("id").onclick=()=>{S.imp=null;$("pres").innerHTML=""};
  $("ib").onclick=importConfirm;
}
function updateImportSum(){
  const I=S.imp;if(!I)return;let inc=0,exp=0,n=0;
  for(const x of I.rows){if(!x.sel)continue;n++;const c=rowCents(x);if(c===null)continue;if(x.type==="income")inc+=c;else exp+=c}
  const e=$("isum");if(e)e.innerHTML=`<b>${n}</b> ${esc(t("selectedL"))} · <span class="inc">${esc(t("income"))} +${fmtMoney(inc)}</span> · <span class="exp">${esc(t("expense"))} −${fmtMoney(exp)}</span>`;
  const b=$("ib");if(b)b.disabled=n===0;
}
function refreshImportRow(row,x){
  if(!row)return;
  row.classList.toggle("dup",rowDup(x));
  const a=row.querySelector(".iamt");if(a)a.innerHTML=`<b>${x.type==="income"?"+":"−"}${esc(x.amt)} €</b>`;
  const g=row.querySelector(".ibdg");
  if(g)g.innerHTML=(rowDup(x)?`<span class="badge">${esc(t("dupBadge"))}</span>`:"")+x.flags.map(f=>`<span class="badge w">⚠ ${esc(t(FLAG_KEY[f]||f))}</span>`).join("");
  updateImportSum();
}
async function importConfirm(){
  const I=S.imp;if(!I||S.saving)return;
  const m=$("imsg"),sel=I.rows.filter(x=>x.sel);
  if(!sel.length)return flash(m,t("nothingSel"));
  const recs=[];let inc=0,exp=0,dups=0;
  for(const x of sel){
    const cents=rowCents(x),desc=x.desc.trim();
    if(!isValidDate(x.date)||cents===null||!desc||!catsFor(x.type).some(c=>c.name===x.cat))
      return flash(m,t("rowInvalid")+" "+(fmtDate(x.date)||"?")+" – "+(desc||"?")+" – "+x.amt);
    if(rowDup(x))dups++;
    if(x.type==="income")inc+=cents;else exp+=cents;
    recs.push({type:x.type,date:x.date,cents,category:x.cat,description:desc.slice(0,120),method:x.method,
      notes:("PDF: "+I.name+(x.full&&x.full!==desc?" – "+x.full:"")).slice(0,300),created:Date.now()});
  }
  const msg=`${recs.length} ${t("txCount")} · ${t("income")} +${fmtMoney(inc)} · ${t("expense")} −${fmtMoney(exp)}. ${dups?t("dupSelected")+" ":""}${t("confirmImport")}`;
  if(!await confirmDlg(msg))return;
  S.saving=true;$("ib").disabled=true;flash(m,t("working"),true);
  try{
    const enc=await Promise.all(recs.map(async r=>{const e=await encJSON(S.dek,r);return{iv:e.iv,ct:e.ct}}));
    await DB.atomic(s=>enc.forEach(r=>s.tx.add(r))); // one transaction: all rows are saved or none
    await loadAll();
    S.imp=null;S.impNote=t("importDone")+" "+recs.length;render();
  }catch(e){flash(m,t("errGeneric")+e.message);if($("ib"))$("ib").disabled=false}
  S.saving=false;
}

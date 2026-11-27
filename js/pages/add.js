"use strict";
function lastFiveHTML(){ // the 5 most recently ADDED records (ids grow with every new entry)
  const l=[...S.tx].sort((a,b)=>b.id-a.id).slice(0,5);
  return `<div class="panel" style="max-width:560px;margin-top:14px"><h2>${esc(t("last5"))}</h2>${l.length?`<table class="txl">${l.map(x=>txRow(x,true)).join("")}</table>`:`<div class="empty">${esc(t("none"))}</div>`}</div>`;
}
function viewAdd(v){
  const ed=S.editId!=null?S.tx.find(x=>x.id===S.editId):null;
  const type=ed?ed.type:S.addType;
  const val=ed||{date:todayISO(),cents:"",category:"",description:"",method:METHODS[0],notes:""};
  const amt=ed?(ed.cents/100).toFixed(2):"";
  v.innerHTML=`<div class="panel" style="max-width:560px">
   <h2>${esc(ed?t("editTx"):(type==="income"?t("addIncome"):t("addExpense")))}</h2>
   ${ed?"":`<div class="seg"><button class="btn i ${type==="income"?"on":""}" data-t="income">${esc(t("addIncome"))}</button><button class="btn e ${type==="expense"?"on":""}" data-t="expense">${esc(t("addExpense"))}</button></div>`}
   <form id="f" novalidate>
    <label>${esc(t("date"))}</label>${dateInput('id="fd"',val.date)}
    <label>${esc(t("amount"))}</label><input type="text" inputmode="decimal" id="fa" value="${esc(amt)}" placeholder="0.00" autocomplete="off">
    <label>${esc(t("category"))}</label><select id="fc">${catsFor(type).map(c=>`<option value="${esc(c.name)}" ${c.name===val.category?"selected":""}>${esc(catLabel(c.name))}</option>`).join("")}</select>
    <button type="button" class="btn sm" id="mc" style="margin-top:6px">${esc(t("categories"))}</button>
    <label>${esc(t("description"))}</label><input type="text" id="fe" value="${esc(val.description)}" maxlength="120" autocomplete="off">
    <label>${esc(t("method"))}</label><select id="fm">${METHODS.map(m=>`<option ${m===val.method?"selected":""}>${esc(m)}</option>`).join("")}</select>
    <label>${esc(t("notes"))}</label><textarea id="fn" rows="2" maxlength="300">${esc(val.notes)}</textarea>
    <div id="fmsg"></div>
    <div class="row" style="margin-top:12px"><button class="btn pri" id="fs" type="submit">${esc(t("save"))}</button><button class="btn" type="button" id="fx">${esc(t("cancel"))}</button></div>
   </form></div>${ed?"":lastFiveHTML()}`;
  v.querySelectorAll("button[data-a]").forEach(b=>b.onclick=()=>txAction(b.dataset.a,+b.dataset.id));
  v.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{S.addType=b.dataset.t;render()});
  $("mc").onclick=()=>catDialog(type);
  $("fx").onclick=()=>{const wasEdit=S.editId!=null;S.editId=null;go(wasEdit?"transactions":"home")};
  $("f").onsubmit=async e=>{e.preventDefault();await saveTx(type,ed)};
}
async function saveTx(type,ed){
  if(S.saving)return; // prevent duplicate submissions
  const msg=$("fmsg"),date=parseDMY($("fd").value),cents=parseCents($("fa").value),cat=$("fc").value,desc=$("fe").value.trim();
  if(!isValidDate(date))return flash(msg,t("invalidDate"));
  if(cents===null)return flash(msg,t("invalidAmt"));
  if(!cat)return flash(msg,t("needCat"));
  if(!desc)return flash(msg,t("needDesc"));
  S.saving=true;$("fs").disabled=true;
  try{
    const rec={type,date,cents,category:cat,description:desc,method:$("fm").value,notes:$("fn").value.trim(),created:ed?ed.created:Date.now()};
    if(ed)rec.id=ed.id;
    await saveRec("transactions",rec);
    await loadAll();
    const wasEdit=!!ed;S.editId=null;
    if(wasEdit){S.view="transactions";render();}
    else{render();flash($("fmsg"),t("saved"),true);}
  }catch(err){flash(msg,"Error: "+err.message);S.saving=false;if($("fs"))$("fs").disabled=false;return}
  S.saving=false;
}

function catDialog(type){
  const draw=(m)=>{
    const d=openDlg(`<h2>${esc(t("categories"))} – ${esc(t(type))}</h2>
    <div style="max-height:46vh;overflow:auto"><table>${catsFor(type).map(c=>`<tr><td>${esc(c.name)}</td><td class="r">${c.def?"":`<button class="btn sm" data-r="${c.id}">${esc(t("rename"))}</button> <button class="btn sm dng" data-d="${c.id}">${esc(t("del"))}</button>`}</td></tr>`).join("")}</table></div>
    <label>${esc(t("newCat"))}</label><div class="row"><input id="nc" maxlength="40" placeholder="${esc(t("catName"))}" style="flex:1"><button class="btn pri" id="na">${esc(t("add_"))}</button></div>
    <div id="cm">${m?`<div class="msg err">${esc(m)}</div>`:""}</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="cl">${esc(t("close"))}</button></div>`);
    d.querySelector("#cl").onclick=()=>{closeDlg();render()};
    d.querySelector("#na").onclick=async()=>{
      const n=d.querySelector("#nc").value.trim();if(!n)return;
      if(S.cats.some(c=>c.type===type&&c.name.toLowerCase()===n.toLowerCase()))return draw(t("catExists"));
      await saveRec("categories",{type,name:n,def:false});await loadAll();draw("");};
    d.querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{
      const c=S.cats.find(x=>x.id===+b.dataset.r);const n=(prompt(t("rename"),c.name)||"").trim().slice(0,40);
      if(!n||n===c.name)return;
      if(S.cats.some(x=>x.type===type&&x.id!==c.id&&x.name.toLowerCase()===n.toLowerCase()))return draw(t("catExists"));
      for(const x of S.tx.filter(x=>x.type===type&&x.category===c.name))await saveRec("transactions",{...x,category:n});
      await saveRec("categories",{...c,name:n});await loadAll();draw("");});
    d.querySelectorAll("[data-d]").forEach(b=>b.onclick=async()=>{
      const c=S.cats.find(x=>x.id===+b.dataset.d);
      if(S.tx.some(x=>x.type===type&&x.category===c.name))return draw(t("catInUse"));
      await DB.del("categories",c.id);await loadAll();draw("");});
  };
  draw("");
}

/* ---- Reports (Phase 2) ---- */
S.rep={mode:"monthly",month:todayISO().slice(0,7),year:todayISO().slice(0,4)};

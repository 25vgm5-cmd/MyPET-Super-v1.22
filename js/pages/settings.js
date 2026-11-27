"use strict";
/* ================= SECTION 7: SETTINGS ================= */
function settingsDialog(msg){
  const d=openDlg(`<h2>${esc(t("settings"))}</h2>
   <label>${esc(t("theme"))}</label><select id="st">${THEMES.map(([k,n])=>`<option value="${k}" ${S.theme===k?"selected":""}>${n}</option>`).join("")}</select>
   <label>${esc(t("opening"))} (€) – may be negative</label>
   <div class="row"><input id="so_" inputmode="decimal" value="${(S.opening/100).toFixed(2)}" style="flex:1"><button class="btn pri" id="sb">${esc(t("saveOpening"))}</button></div>
   <div id="sm">${msg?`<div class="msg ${msg.ok?"ok":"err"}">${esc(msg.t)}</div>`:""}</div>
   <button class="btn" id="scp" style="margin-top:6px">${esc(t("changePw"))}</button>
   <h2 style="margin-top:16px">${esc(t("info"))}</h2>
   <p class="muted" style="font-size:13px">MyPET Super v1.22<br>${esc(t("currency"))}<br>${esc(t("dateFmt"))}<br>${esc(t("storageNote"))}</p>
   <div class="row" style="justify-content:space-between;margin-top:10px"><button class="btn dng" id="sr">${esc(t("reset"))}</button><button class="btn" id="sc">${esc(t("close"))}</button></div>`);
  d.querySelector("#sc").onclick=closeDlg;
  d.querySelector("#scp").onclick=()=>changePwDialog();
  d.querySelector("#st").onchange=async e=>{S.theme=e.target.value;await setSetting("theme",S.theme);applyTheme()};
  d.querySelector("#sb").onclick=async()=>{
    const raw=d.querySelector("#so_").value.trim();
    const neg=raw.startsWith("-"),c=raw===""||/^-?0([.,]0{1,2})?$/.test(raw)?0:parseCents(neg?raw.slice(1):raw);
    if(c===null)return settingsDialog({t:t("invalidAmt"),ok:false});
    S.opening=neg?-c:c;await saveOpening(S.opening);render();settingsDialog({t:t("noteSet"),ok:true});};
  d.querySelector("#sr").onclick=async()=>{
    if(!await confirmDlg(t("confirmReset")))return settingsDialog();
    await DB.atomic(s=>{s.tx.clear();s.cat.clear();s.set.delete("openingEnc")});
    await loadAll();await seedCategories();S.filter={q:"",from:"",to:"",type:"all",cat:"all",sort:"new"};S.editId=null;S.view="home";render();closeDlg();};
}


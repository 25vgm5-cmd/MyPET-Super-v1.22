"use strict";
/* ================= SECTION 6: VIEWS ================= */
function renderNav(){
  $("nav").innerHTML=`<div class="brand">MyPET Super</div>`+NAV.map(([k,ic])=>`<button data-v="${k}" class="${S.view===k?"on":""}"><span class="ic">${ic}</span><span>${esc(t(k))}</span></button>`).join("");
  $("nav").querySelectorAll("button").forEach(b=>b.onclick=()=>go(b.dataset.v));
  $("title").textContent=t(S.view==="home"?"dashboard":S.view);
  $("sub").textContent=S.view==="home"?t("homeSub"):"";
  $("ph").textContent=S.view==="reports"?"":"MyPET Super – "+t(S.view==="home"?"dashboard":S.view)+" – "+fmtDate(todayISO());
}
function go(v){S.view=v;if(v!=="add")S.editId=null;render()}
function render(){renderNav();const v=$("view");
  ({home:viewHome,add:viewAdd,transactions:viewTx,reports:viewReports,import:viewImport,backup:viewBackup,help:viewHelp})[S.view](v);
  window.scrollTo(0,0)}

function addDaysISO(iso,n){const p=iso.split("-").map(Number),d=new Date(Date.UTC(p[0],p[1]-1,p[2]+n));
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0")}

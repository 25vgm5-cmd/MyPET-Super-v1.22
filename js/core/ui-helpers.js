"use strict";
/* ================= SECTION 5: UI HELPERS ================= */
function flash(el,msg,ok){el.innerHTML=msg?`<div class="msg ${ok?"ok":"err"}">${esc(msg)}</div>`:""}
function openDlg(html){const d=$("dlg");d.innerHTML=html;if(!d.open)d.showModal();return d}
function closeDlg(){const d=$("dlg");if(d.open)d.close()}
function confirmDlg(msg){return new Promise(res=>{
  const d=openDlg(`<p>${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn" id="cn">${esc(t("no"))}</button><button class="btn pri" id="cy">${esc(t("yes"))}</button></div>`);
  d.querySelector("#cn").onclick=()=>{closeDlg();res(false)};
  d.querySelector("#cy").onclick=()=>{closeDlg();res(true)};
  d.oncancel=()=>res(false);
})}
/* ---- DD-MM-YYYY date fields: the browser's own <input type="date"> follows the browser language (e.g. 12/27/2024), so a text field is used ---- */
function parseDMY(s){ // "27-12-2024" (also / or .) -> "2024-12-27", or "" when incomplete/invalid
  const m=/^\s*(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\s*$/.exec(s||"");
  if(!m)return "";
  const iso=m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0");
  return isValidDate(iso)?iso:"";
}
function dateInput(attrs,iso){ // text field shown as DD-MM-YYYY + calendar button
  return `<span class="dwrap"><input type="text" inputmode="numeric" data-dmy ${attrs} value="${esc(fmtDate(iso))}" placeholder="DD-MM-YYYY" maxlength="10" autocomplete="off"><button type="button" class="btn dcal" tabindex="-1" aria-label="calendar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></button></span>`;
}
document.addEventListener("input",e=>{ // typing 27122024 or 27-12-2024 both give 27-12-2024
  const el=e.target;if(!(el instanceof HTMLInputElement)||!el.hasAttribute("data-dmy"))return;
  if(e.inputType&&e.inputType.startsWith("delete"))return;
  let v=el.value.replace(/[^\d\-\/.]/g,"").replace(/[\/.]/g,"-");
  if(/^\d{8}$/.test(v))v=v.slice(0,2)+"-"+v.slice(2,4)+"-"+v.slice(4);
  else if(/^\d{2}$/.test(v)||/^\d{1,2}-\d{2}$/.test(v))v+="-";
  el.value=v.slice(0,10);
},true);
document.addEventListener("click",e=>{ // calendar button: open the native picker, write the result back as DD-MM-YYYY
  const b=e.target.closest&&e.target.closest("button.dcal");if(!b)return;
  const inp=b.parentElement.querySelector("input[data-dmy]");if(!inp)return;
  const r=b.getBoundingClientRect(),nat=document.createElement("input");
  nat.type="date";nat.className="dnat";nat.value=parseDMY(inp.value)||todayISO();nat.tabIndex=-1;
  nat.style.cssText=`position:fixed;left:${Math.round(r.left)}px;top:${Math.round(r.bottom)}px;width:1px;height:1px;opacity:0;border:0;padding:0`;
  document.body.appendChild(nat);
  const done=()=>setTimeout(()=>nat.remove(),300);
  nat.onchange=()=>{if(nat.value){inp.value=fmtDate(nat.value);inp.dispatchEvent(new Event("input",{bubbles:true}));inp.dispatchEvent(new Event("change",{bubbles:true}))}done()};
  nat.onblur=done;
  try{nat.showPicker()}catch(_){nat.focus();nat.click()}
});
function catsFor(type){return S.cats.filter(c=>c.type===type).sort((a,b)=>(b.def?1:0)-(a.def?1:0)||a.name.localeCompare(b.name))}
function txRow(x,actions){
  return `<tr><td class="d">${fmtDate(x.date)}</td><td class="m">${esc(x.description)}<div class="muted" style="font-size:12px">${esc(catLabel(x.category))}</div></td>
  <td class="r a ${x.type==="income"?"inc":"exp"}">${x.type==="income"?"+":"−"}${fmtMoney(x.cents)}</td>${actions?`<td class="r act" style="white-space:nowrap">
  <button class="btn sm" data-a="det" data-id="${x.id}">${esc(t("details"))}</button> <button class="btn sm" data-a="edit" data-id="${x.id}">${esc(t("edit"))}</button> <button class="btn sm dng" data-a="del" data-id="${x.id}">${esc(t("del"))}</button></td>`:""}</tr>`;
}


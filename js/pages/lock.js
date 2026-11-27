"use strict";
/* ================= SECTION 7B: LOGIN, LOCK, PASSWORD ================= */
const IDLE_MS=5*60*1000;
const getAuth=async()=>{const r=(await DB.all("settings")).find(x=>x.key==="auth");return r?r.value:null};
function hideLock(){$("lock").style.display="none"}
function showLock(mode,note){
  const el=$("lock"),setup=mode==="setup";el.style.display="flex";
  el.innerHTML=`<div class="panel lockbox"><div class="brand">MyPET Super</div>
   <h2>${esc(t(setup?"setupTitle":"loginTitle"))}</h2>
   ${setup?`<p class="muted" style="font-size:13px">${esc(t("setupInfo"))}</p><div class="msg err" style="font-size:13px">${esc(t("pwWarn"))}</div>`:""}
   <form id="lf" novalidate>
    <label>${esc(t("password"))}</label><input type="password" id="lp" autocomplete="${setup?"new-password":"current-password"}">
    ${setup?`<label>${esc(t("confirmPassword"))}</label><input type="password" id="lp2" autocomplete="new-password">`:""}
    <div id="lm">${note?`<div class="msg ${note.ok?"ok":"err"}">${esc(note.t)}</div>`:""}</div>
    <button class="btn pri" id="lb" type="submit" style="width:100%;margin-top:10px">${esc(t(setup?"setPassword":"unlock"))}</button>
   </form>
   ${setup?"":`<p style="text-align:center;margin-top:14px"><button class="btn sm dng" id="lforgot" type="button">${esc(t("forgot"))}</button></p>`}
   </div>`;
  $("lf").onsubmit=async e=>{
    e.preventDefault();if(S.busy)return;
    const pw=$("lp").value,m=$("lm");
    if(setup){if(pw.length<MIN_PW)return flash(m,t("pwShort"));if(pw!==$("lp2").value)return flash(m,t("pwMismatch"))}
    else if(!pw)return flash(m,t("wrongPw"));
    S.busy=true;$("lb").disabled=true;flash(m,t("working"),true);
    try{await (setup?doSetup(pw):doUnlock(pw))}
    catch(err){S.busy=false;showLock(mode,{t:err.message==="BAD_PW"?t("wrongPw"):t("errGeneric")+err.message});return}
    S.busy=false;
  };
  if(!setup)$("lforgot").onclick=eraseDialog;
  $("lp").focus();
}
async function doUnlock(pw){
  let dek;
  try{dek=await unlockVault(pw,await getAuth())}catch(e){throw new Error("BAD_PW")}
  S.dek=dek;await enterApp();
}
async function doSetup(pw){ // creates the vault and encrypts any existing plaintext data in ONE transaction
  const {dek,auth}=await createVault(pw);
  const tx=await DB.all("transactions"),cats=await DB.all("categories"),st=await DB.all("settings");
  if([...tx,...cats].some(r=>r.ct!==undefined))throw new Error("Encrypted data found without password information.");
  const enc=async r=>{const {id,...rest}=r;const e=await encJSON(dek,rest);return{id,iv:e.iv,ct:e.ct}};
  const txR=await Promise.all(tx.map(enc)),catR=await Promise.all(cats.map(enc));
  const old=st.find(x=>x.key==="opening");
  const openR=old&&Number.isSafeInteger(old.value)?{key:"openingEnc",value:await encJSON(dek,{v:old.value})}:null;
  await DB.atomic(s=>{txR.forEach(r=>s.tx.put(r));catR.forEach(r=>s.cat.put(r));
    if(openR)s.set.put(openR);s.set.delete("opening");s.set.put({key:"auth",value:auth})});
  S.dek=dek;await enterApp();
}
async function enterApp(){
  await loadAll();await seedCategories();
  S.last=Date.now();S.view="home";hideLock();render();startIdleWatch();
}
function themeDialog(){
  const d=openDlg(`<h2>${esc(t("themeTitle"))}</h2><div class="thl">${THEMES.map(([k,n,c])=>`<button type="button" class="btn thb ${S.theme===k?"on":""}" data-th="${k}"><i class="sw" style="background:${c}"></i>${n}${S.theme===k?" ✓":""}</button>`).join("")}</div>
   <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="thc">${esc(t("close"))}</button></div>`);
  d.querySelectorAll("[data-th]").forEach(b=>b.onclick=async()=>{S.theme=b.dataset.th;await setSetting("theme",S.theme);applyTheme();themeDialog()});
  d.querySelector("#thc").onclick=closeDlg;
}
async function lockClick(){if(await confirmDlg(t("lockConfirm")))lockApp(t("loggedOut"))}
function tickClock(){const el=$("clock");if(!el)return;const d=new Date(),p=n=>String(n).padStart(2,"0");
  el.textContent=p(d.getDate())+" "+MONTHS.en[d.getMonth()]+" "+d.getFullYear()+" | "+p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds())}
function lockApp(msg){ // logout and auto-lock: wipe decrypted data and the key from memory
  S.dek=null;S.tx=[];S.cats=[];S.opening=0;S.editId=null;S.saving=false;S.restore=null;S.imp=null;S.impNote=null;S.corrupt=0;
  closeDlg();$("dlg").innerHTML="";$("view").innerHTML="";
  showLock("login",msg?{t:msg,ok:true}:null);
}
let idleTimer=null;
function startIdleWatch(){
  if(idleTimer)return;
  const touch=()=>{S.last=Date.now()};
  ["pointerdown","pointermove","keydown","touchstart","scroll","wheel","input"].forEach(ev=>document.addEventListener(ev,touch,{passive:true,capture:true}));
  const check=()=>{if(S.dek&&Date.now()-S.last>=IDLE_MS)lockApp(t("autoLocked"))};
  idleTimer=setInterval(check,5000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});
}
function eraseDialog(){
  const d=openDlg(`<h2>${esc(t("eraseTitle"))}</h2><p>${esc(t("eraseInfo"))}</p><input id="ec" autocomplete="off">
   <div id="em"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="en">${esc(t("cancel"))}</button><button class="btn dng" id="ey">${esc(t("eraseBtn"))}</button></div>`);
  d.querySelector("#en").onclick=closeDlg;
  d.querySelector("#ey").onclick=async()=>{
    if(d.querySelector("#ec").value.trim()!=="DELETE")return flash(d.querySelector("#em"),t("eraseInfo"));
    await DB.atomic(s=>{s.tx.clear();s.cat.clear();["auth","openingEnc","opening"].forEach(k=>s.set.delete(k))});
    closeDlg();showLock("setup");
  };
}
function changePwDialog(){
  const d=openDlg(`<h2>${esc(t("changePw"))}</h2><div class="msg err" style="font-size:13px">${esc(t("pwWarn"))}</div>
   <label>${esc(t("currentPw"))}</label><input type="password" id="cp0" autocomplete="current-password">
   <label>${esc(t("newPw"))}</label><input type="password" id="cp1" autocomplete="new-password">
   <label>${esc(t("confirmPassword"))}</label><input type="password" id="cp2" autocomplete="new-password">
   <div id="cm2"></div><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="cpx">${esc(t("close"))}</button><button class="btn pri" id="cps">${esc(t("save"))}</button></div>`);
  const m=d.querySelector("#cm2");
  d.querySelector("#cpx").onclick=closeDlg;
  d.querySelector("#cps").onclick=async()=>{
    const a=d.querySelector("#cp0").value,b=d.querySelector("#cp1").value,c=d.querySelector("#cp2").value,btn=d.querySelector("#cps");
    if(b.length<MIN_PW)return flash(m,t("pwShort"));if(b!==c)return flash(m,t("pwMismatch"));
    btn.disabled=true;flash(m,t("working"),true);
    try{await unlockVault(a,await getAuth())}catch(e){btn.disabled=false;return flash(m,t("wrongPw"))}
    try{await DB.put("settings",{key:"auth",value:await wrapDek(S.dek,b)});flash(m,t("pwChanged"),true);
      ["#cp0","#cp1","#cp2"].forEach(i=>d.querySelector(i).value="")}
    catch(e){flash(m,t("errGeneric")+e.message)}
    btn.disabled=false;
  };
}


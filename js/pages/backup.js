"use strict";
/* ================= SECTION 7C: BACKUP AND RESTORE ================= */
function buildBackupPayload(){
  const strip=({id,...r})=>r;
  return{app:"MyPET(Super)v1.2",version:1,created:new Date().toISOString(),opening:S.opening,
    categories:S.cats.map(strip),transactions:S.tx.map(strip),settings:{lang:S.lang,theme:S.theme}};
}
function downloadText(text,name,type){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function viewBackup(v){
  v.innerHTML=`<div class="msg err">${esc(t("pwWarn"))}</div><div class="grid2">
   <div class="panel"><h2>${esc(t("createBackup"))}</h2><p class="muted" style="font-size:13px">${esc(t("backupInfo"))}</p>
    <label>${esc(t("backupPw"))}</label><input type="password" id="bp1" autocomplete="new-password">
    <label>${esc(t("confirmPassword"))}</label><input type="password" id="bp2" autocomplete="new-password">
    <div id="bm"></div><button class="btn pri" id="bb" style="margin-top:10px">${esc(t("downloadBackup"))}</button></div>
   <div class="panel"><h2>${esc(t("restoreBackup"))}</h2>
    <label>${esc(t("backupFile"))}</label><input type="file" id="rf">
    <label>${esc(t("backupPw"))}</label><input type="password" id="rp1" autocomplete="off">
    <div id="rmsg"></div><button class="btn pri" id="rv" style="margin-top:10px">${esc(t("verifyPreview"))}</button><div id="rprev"></div></div></div>`;
  $("bb").onclick=async()=>{
    const a=$("bp1").value,m=$("bm");
    if(a.length<MIN_PW)return flash(m,t("pwShort"));if(a!==$("bp2").value)return flash(m,t("pwMismatch"));
    $("bb").disabled=true;flash(m,t("working"),true);
    try{
      const f=await makeBackupFile(a,buildBackupPayload());
      downloadText(JSON.stringify(f),"MyPET-backup_"+todayISO()+".MyPET","application/octet-stream");
      $("bp1").value="";$("bp2").value="";flash(m,t("backupDone"),true);
    }catch(e){flash(m,t("errGeneric")+e.message)}
    $("bb").disabled=false;
  };
  $("rv").onclick=restorePreview;
}
async function restorePreview(){
  const m=$("rmsg"),file=$("rf").files[0],pw=$("rp1").value;
  $("rprev").innerHTML="";S.restore=null;
  if(!file)return flash(m,t("pickFile"));
  if(file.size>50*1024*1024)return flash(m,t("errStructure"));
  if(!pw)return flash(m,t("enterBackupPw"));
  $("rv").disabled=true;flash(m,t("working"),true);
  try{
    let f;try{f=JSON.parse(await file.text())}catch(e){throw new Error("STRUCTURE")}
    const obj=await openBackupFile(pw,f);          // structure check + decrypt (AES-GCM verifies integrity)
    const r=validateBackupPayload(obj);            // validate recovered data
    if(!r.ok){flash(m,t("errData")+" "+r.error);return}
    S.restore=r.data;flash(m,"");showRestorePreview();
  }catch(e){
    const k={NOT_MyPET:"errNotBackup",FORMAT:"errNotBackup",KDF:"errNotBackup",STRUCTURE:"errStructure",BAD_PW:"errPw"}[e.message];
    flash(m,k?t(k):t("errGeneric")+e.message);
  }finally{if($("rv"))$("rv").disabled=false}
}
function showRestorePreview(){
  const d=S.restore,s=sumTx(d.transactions),dates=d.transactions.map(x=>x.date).sort();
  $("rprev").innerHTML=`<h2 style="margin-top:14px">${esc(t("restorePreview"))}</h2><table>
   <tr><td>${esc(t("transactions"))}</td><td class="r">${d.transactions.length}</td></tr>
   <tr><td>${esc(t("catCount"))}</td><td class="r">${d.categories.length}</td></tr>
   <tr><td>${esc(t("periodL"))}</td><td class="r">${dates.length?fmtDate(dates[0])+" → "+fmtDate(dates[dates.length-1]):"—"}</td></tr>
   <tr><td>${esc(t("opening"))}</td><td class="r">${fmtMoney(d.opening)}</td></tr>
   <tr><td>${esc(t("totalIncome"))}</td><td class="r inc">${fmtMoney(s.income)}</td></tr>
   <tr><td>${esc(t("totalExpenses"))}</td><td class="r exp">${fmtMoney(s.expense)}</td></tr>
   <tr><td><b>${esc(t("finalBalance"))}</b></td><td class="r"><b>${fmtMoney(d.opening+s.net)}</b></td></tr></table>
   <div class="msg err" style="font-size:13px">${esc(t("restoreReplaceWarn"))}</div>
   <label>${esc(t("safetyPw"))}</label><input type="password" id="rsp" autocomplete="new-password">
   <div id="rmsg2"></div><button class="btn dng" id="rok" style="margin-top:10px">${esc(t("restoreBtn"))}</button>`;
  $("rok").onclick=restoreConfirm;
}
async function restoreConfirm(){
  const m=$("rmsg2"),sp=$("rsp").value,data=S.restore;
  if(!data)return;
  if(sp.length<MIN_PW)return flash(m,t("pwShort"));
  if(!await confirmDlg(t("confirmRestore")))return;
  $("rok").disabled=true;flash(m,t("working"),true);
  try{
    // 1. safety backup of the CURRENT data, downloaded before anything is replaced
    const sf=await makeBackupFile(sp,buildBackupPayload());
    const stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    downloadText(JSON.stringify(sf),"MyPET-safety-backup-"+stamp+".MyPET","application/octet-stream");
    // 2. re-encrypt the restored data under this vault's key (fresh IV per record)
    const e1=async x=>{const e=await encJSON(S.dek,x);return{iv:e.iv,ct:e.ct}};
    const txR=await Promise.all(data.transactions.map(e1)),catR=await Promise.all(data.categories.map(e1));
    const openR={key:"openingEnc",value:await encJSON(S.dek,{v:data.opening})};
    // 3. one atomic write: if anything fails, existing records are left untouched
    await DB.atomic(s=>{s.tx.clear();s.cat.clear();txR.forEach(r=>s.tx.add(r));catR.forEach(r=>s.cat.add(r));
      s.set.put(openR);s.set.put({key:"lang",value:data.lang});s.set.put({key:"theme",value:data.theme})});
    S.lang=data.lang;S.theme=data.theme;S.restore=null;applyTheme();
    await loadAll();await seedCategories();render();flash($("rmsg"),t("restoreDone"),true);
  }catch(e){flash(m,t("errGeneric")+e.message);if($("rok"))$("rok").disabled=false}
}


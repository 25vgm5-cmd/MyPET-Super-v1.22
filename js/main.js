"use strict";
/* ================= SECTION 8: STARTUP ================= */
(async function init(){
  try{
    if(!window.indexedDB||!window.crypto||!crypto.subtle)throw new Error("IndexedDB and Web Crypto are required. Open MyPET through a local web server or HTTPS (not file://).");
    await DB.open();await loadSettings();applyTheme();
    $("tbPrint").onclick=()=>window.print();
    $("tbBackup").onclick=()=>go("backup");
    $("tbSettings").onclick=()=>settingsDialog();
    $("tbTheme").onclick=()=>themeDialog();
    $("tbLock").onclick=lockClick;
    tickClock();setInterval(tickClock,1000);
    showLock((await getAuth())?"login":"setup");
  }catch(e){
    document.body.innerHTML=`<div style="padding:24px;font-family:sans-serif"><h2>MyPET Super could not start</h2><p>${esc(e.message)}</p></div>`;
  }
})();

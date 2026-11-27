"use strict";
/* ================= SECTION 4: STATE ================= */
const S={view:"home",tx:[],cats:[],opening:0,lang:"en",theme:"light",dek:null,corrupt:0,last:0,busy:false,restore:null,imp:null,impNote:null,
  period:todayISO().slice(0,7),editId:null,addType:"income",saving:false,
  filter:{q:"",from:"",to:"",type:"all",cat:"all",sort:"new"}};
const $=id=>document.getElementById(id);
const t=k=>EN[k]||k;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function loadSettings(){ // language/theme only: not financial data, stored in plain form
  const st=await DB.all("settings");const g=k=>{const r=st.find(x=>x.key===k);return r?r.value:undefined};
  S.lang="en";S.theme=THEMES.some(x=>x[0]===g("theme"))?g("theme"):"light";
}
async function loadAll(){ // decrypts all financial records into memory (needs the unlocked key)
  S.corrupt=0;
  const dec=async r=>{try{return{...await decJSON(S.dek,r),id:r.id}}catch(e){S.corrupt++;return null}};
  S.tx=(await Promise.all((await DB.all("transactions")).map(dec))).filter(Boolean);
  S.cats=(await Promise.all((await DB.all("categories")).map(dec))).filter(Boolean);
  const o=(await DB.all("settings")).find(x=>x.key==="openingEnc");
  S.opening=0;
  if(o){try{const v=await decJSON(S.dek,o.value);if(Number.isSafeInteger(v.v))S.opening=v.v;else S.corrupt++}catch(e){S.corrupt++}}
}
async function saveRec(store,rec){ // encrypt one record and store it ({id} stays as the plain key)
  const {id,...rest}=rec;const e=await encJSON(S.dek,rest);
  const out={iv:e.iv,ct:e.ct};if(id!==undefined)out.id=id;
  return DB.put(store,out);
}
async function saveOpening(v){await DB.put("settings",{key:"openingEnc",value:await encJSON(S.dek,{v})})}
async function seedCategories(){
  if(S.cats.length)return;
  for(const type of ["income","expense"])for(const name of DEFAULT_CATS[type])
    await saveRec("categories",{type,name,def:true});
  await loadAll();
}
const setSetting=(key,value)=>DB.put("settings",{key,value});
function applyTheme(){document.documentElement.dataset.theme=S.theme;document.documentElement.lang="en";
  const m=document.querySelector('meta[name="theme-color"]'),th=THEMES.find(x=>x[0]===S.theme);if(m&&th)m.content=th[2]}
function catLabel(name){return name}


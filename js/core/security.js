"use strict";
/* ================= SECTION 2B: SECURITY (Web Crypto, no DOM) ================= */
// SEC-START
const KDF_ITER=600000; // PBKDF2-HMAC-SHA256 iterations (OWASP guidance for SHA-256)
const MIN_PW=8;
const BACKUP_APPS=["MyPET(Super)v1.2","MyPET(Super)v1.1","MyPET"]; // accepted on restore; new backups are written as MyPET(Super)v1.2
function b64(u8){let s="";for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function rnd(n){return crypto.getRandomValues(new Uint8Array(n))}
async function deriveKey(password,salt,iter,usages){
  const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(password).normalize("NFKC")),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},base,{name:"AES-GCM",length:256},false,usages);
}
async function aesEnc(key,u8){ // fresh random 96-bit IV for every single encryption
  const iv=rnd(12);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,u8));
  return{iv:b64(iv),ct:b64(ct)};
}
async function aesDec(key,iv,ct){return new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},key,unb64(ct)))}
// Key hierarchy: random DEK encrypts records; KEK (from password via PBKDF2) encrypts the DEK.
async function wrapDek(dek,password){
  const salt=rnd(16),kek=await deriveKey(password,salt,KDF_ITER,["encrypt"]);
  const raw=new Uint8Array(await crypto.subtle.exportKey("raw",dek));
  const e=await aesEnc(kek,raw);raw.fill(0);
  return{v:1,kdf:"PBKDF2-SHA256",iter:KDF_ITER,salt:b64(salt),iv:e.iv,ct:e.ct};
}
async function createVault(password){
  const dek=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
  return{dek,auth:await wrapDek(dek,password)};
}
async function unlockVault(password,auth){ // throws if the password is wrong
  if(!auth||!Number.isInteger(auth.iter)||auth.iter<100000||auth.iter>5000000)throw new Error("BAD_AUTH");
  const kek=await deriveKey(password,unb64(auth.salt),auth.iter,["decrypt"]);
  const raw=await aesDec(kek,auth.iv,auth.ct);
  const dek=await crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},true,["encrypt","decrypt"]);
  raw.fill(0);return dek;
}
async function encJSON(dek,obj){return aesEnc(dek,new TextEncoder().encode(JSON.stringify(obj)))}
async function decJSON(dek,rec){return JSON.parse(new TextDecoder().decode(await aesDec(dek,rec.iv,rec.ct)))}
// Encrypted backup files (own password + own salt, independent of the login password)
async function makeBackupFile(password,payload,iter=KDF_ITER){
  const salt=rnd(16),key=await deriveKey(password,salt,iter,["encrypt"]);
  const e=await aesEnc(key,new TextEncoder().encode(JSON.stringify(payload)));
  return{app:"MyPET(Super)v1.2",type:"backup",format:1,kdf:{name:"PBKDF2",hash:"SHA-256",iterations:iter,salt:b64(salt)},cipher:{name:"AES-GCM",iv:e.iv},data:e.ct};
}
function checkBackupFile(f){ // returns an error code or null
  try{
    if(!f||!BACKUP_APPS.includes(f.app)||f.type!=="backup")return "NOT_MyPET";
    if(f.format!==1)return "FORMAT";
    if(!f.kdf||f.kdf.name!=="PBKDF2"||f.kdf.hash!=="SHA-256")return "KDF";
    const it=f.kdf.iterations;
    if(!Number.isInteger(it)||it<100000||it>5000000)return "KDF";
    if(unb64(f.kdf.salt).length!==16)return "STRUCTURE";
    if(!f.cipher||f.cipher.name!=="AES-GCM"||unb64(f.cipher.iv).length!==12)return "STRUCTURE";
    if(typeof f.data!=="string"||unb64(f.data).length<17)return "STRUCTURE";
    return null;
  }catch(e){return "STRUCTURE"}
}
async function openBackupFile(password,f){ // throws NOT_MyPET/FORMAT/KDF/STRUCTURE/BAD_PW
  const err=checkBackupFile(f);if(err)throw new Error(err);
  const key=await deriveKey(password,unb64(f.kdf.salt),f.kdf.iterations,["decrypt"]);
  let plain;try{plain=await aesDec(key,f.cipher.iv,f.data)}catch(e){throw new Error("BAD_PW")}
  try{return JSON.parse(new TextDecoder().decode(plain))}catch(e){throw new Error("STRUCTURE")}
}
function validateBackupPayload(p){ // validates + rebuilds clean records; never trusts file content
  const fail=e=>({ok:false,error:e});
  if(!p||typeof p!=="object"||!BACKUP_APPS.includes(p.app)||p.version!==1)return fail("unsupported content");
  if(!Array.isArray(p.transactions)||!Array.isArray(p.categories))return fail("structure");
  if(p.transactions.length>500000||p.categories.length>5000)return fail("too large");
  if(!Number.isSafeInteger(p.opening))return fail("opening balance");
  const str=(v,max)=>typeof v==="string"&&v.length<=max;
  const TY=["income","expense"],cats=[],seen=new Set(),txs=[];
  for(const c of p.categories){
    if(!c||!TY.includes(c.type)||!str(c.name,40)||!c.name.trim())return fail("category");
    const k=c.type+"|"+c.name.toLowerCase();if(seen.has(k))continue;seen.add(k);
    cats.push({type:c.type,name:c.name,def:c.def===true});
  }
  for(let i=0;i<p.transactions.length;i++){
    const x=p.transactions[i];
    if(!x||!TY.includes(x.type)||!isValidDate(x.date)||!Number.isSafeInteger(x.cents)||x.cents<=0||
       !str(x.category,40)||!x.category.trim()||!str(x.description,120)||!x.description.trim()||
       !str(x.method==null?"":x.method,40)||!str(x.notes==null?"":x.notes,300))return fail("transaction "+(i+1));
    txs.push({type:x.type,date:x.date,cents:x.cents,category:x.category,description:x.description,
      method:x.method||"Other",notes:x.notes||"",created:Number.isSafeInteger(x.created)?x.created:0});
    const k=x.type+"|"+x.category.toLowerCase();
    if(!seen.has(k)){seen.add(k);cats.push({type:x.type,name:x.category,def:false})}
  }
  const st=p.settings&&typeof p.settings==="object"?p.settings:{};
  return{ok:true,data:{opening:p.opening,categories:cats,transactions:txs,lang:"en",theme:["light","dark","green","blue","gray"].includes(st.theme)?st.theme:"light"}};
}
// SEC-END


"use strict";
/* ================= SECTION 3: DATABASE (IndexedDB) ================= */
const DB={
  db:null,
  open(){return new Promise((res,rej)=>{
    const r=indexedDB.open("MyPET(Super)v1.1",1);
    r.onupgradeneeded=()=>{const d=r.result;
      d.createObjectStore("transactions",{keyPath:"id",autoIncrement:true});
      d.createObjectStore("categories",{keyPath:"id",autoIncrement:true});
      d.createObjectStore("settings",{keyPath:"key"});};
    r.onsuccess=()=>{this.db=r.result;res()};
    r.onerror=()=>rej(r.error);
  })},
  run(stores,mode,fn){return new Promise((res,rej)=>{
    const t=this.db.transaction(stores,mode);let out;
    const o=Array.isArray(stores)?stores.map(s=>t.objectStore(s)):t.objectStore(stores);
    const rq=fn(o);if(rq&&rq.onsuccess!==undefined)rq.onsuccess=()=>out=rq.result;
    t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error("aborted"));
  })},
  all(s){return this.run(s,"readonly",st=>st.getAll())},
  put(s,v){return this.run(s,"readwrite",st=>st.put(v))},
  del(s,id){return this.run(s,"readwrite",st=>st.delete(id))},
  clear(s){return this.run(s,"readwrite",st=>st.clear())},
  atomic(fn){return new Promise((res,rej)=>{ // several stores, ONE transaction: all changes happen or none do
    const t=this.db.transaction(["transactions","categories","settings"],"readwrite");
    try{fn({tx:t.objectStore("transactions"),cat:t.objectStore("categories"),set:t.objectStore("settings")})}catch(e){try{t.abort()}catch(_){}return rej(e)}
    t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error("aborted"));
  })}
};


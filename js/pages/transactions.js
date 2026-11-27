"use strict";
function filteredTx(){
  const f=S.filter,q=f.q.trim().toLowerCase();
  let l=S.tx.filter(x=>
    (f.type==="all"||x.type===f.type)&&(f.cat==="all"||x.category===f.cat)&&
    (!f.from||x.date>=f.from)&&(!f.to||x.date<=f.to)&&
    (!q||(x.description+" "+x.category+" "+x.notes+" "+x.method+" "+fmtMoney(x.cents)).toLowerCase().includes(q)));
  l.sort((a,b)=>{const c=a.date.localeCompare(b.date)||a.id-b.id;return f.sort==="new"?-c:c});
  return l;
}
function viewTx(v){
  const f=S.filter;
  v.innerHTML=`<div class="panel" style="margin-bottom:14px"><div class="filters">
   <div><label>${esc(t("search"))}</label><input id="q" value="${esc(f.q)}"></div>
   <div><label>${esc(t("from"))}</label>${dateInput('id="df"',f.from)}</div>
   <div><label>${esc(t("to"))}</label>${dateInput('id="dt"',f.to)}</div>
   <div><label>${esc(t("type"))}</label><select id="ty"><option value="all">${esc(t("all"))}</option><option value="income" ${f.type==="income"?"selected":""}>${esc(t("income"))}</option><option value="expense" ${f.type==="expense"?"selected":""}>${esc(t("expense"))}</option></select></div>
   <div><label>${esc(t("category"))}</label><select id="ct"><option value="all">${esc(t("all"))}</option>${[...new Set(S.cats.map(c=>c.name))].sort().map(n=>`<option value="${esc(n)}" ${f.cat===n?"selected":""}>${esc(catLabel(n))}</option>`).join("")}</select></div>
   <div><label>&nbsp;</label><select id="so"><option value="new">${esc(t("newest"))}</option><option value="old" ${f.sort==="old"?"selected":""}>${esc(t("oldest"))}</option></select></div>
  </div></div><div id="tl"></div>`;
  const bind=(id,key)=>{$(id).oninput=e=>{S.filter[key]=e.target.value;list()}};
  const bindD=(id,key)=>{$(id).oninput=e=>{S.filter[key]=parseDMY(e.target.value);list()}}; // incomplete text = no filter
  bind("q","q");bindD("df","from");bindD("dt","to");bind("ty","type");bind("ct","cat");bind("so","sort");
  list();
}
function list(){
  const l=filteredTx(),s=sumTx(l),el=$("tl");
  el.innerHTML=`<div class="cards">
   <div class="card"><div class="l">${esc(t("totalIncome"))}</div><div class="v inc">${fmtMoney(s.income)}</div></div>
   <div class="card"><div class="l">${esc(t("totalExpenses"))}</div><div class="v exp">${fmtMoney(s.expense)}</div></div>
   <div class="card"><div class="l">${esc(t("netBalance"))}</div><div class="v ${s.net<0?"exp":"inc"}">${fmtMoney(s.net)}</div></div></div>
   <div class="panel">${l.length?`<table class="txl">${l.map(x=>txRow(x,true)).join("")}</table>`:`<div class="empty">${esc(t("none"))}</div>`}</div>`;
  el.querySelectorAll("button[data-a]").forEach(b=>b.onclick=()=>txAction(b.dataset.a,+b.dataset.id));
}
async function txAction(a,id){
  const x=S.tx.find(r=>r.id===id);if(!x)return;
  if(a==="edit"){S.editId=id;S.view="add";render()}
  else if(a==="det"){
    const d=openDlg(`<h2>${esc(t("details"))}</h2><table>
     <tr><th>${esc(t("type"))}</th><td>${esc(t(x.type))}</td></tr><tr><th>${esc(t("date"))}</th><td>${fmtDate(x.date)}</td></tr>
     <tr><th>${esc(t("amount"))}</th><td class="${x.type==="income"?"inc":"exp"}">${fmtMoney(x.cents)}</td></tr>
     <tr><th>${esc(t("category"))}</th><td>${esc(catLabel(x.category))}</td></tr><tr><th>${esc(t("description"))}</th><td>${esc(x.description)}</td></tr>
     <tr><th>${esc(t("method"))}</th><td>${esc(x.method)}</td></tr><tr><th>${esc(t("notes"))}</th><td>${esc(x.notes)||"—"}</td></tr></table>
     <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="cl">${esc(t("close"))}</button></div>`);
    d.querySelector("#cl").onclick=closeDlg;
  }else if(a==="del"){
    if(await confirmDlg(t("confirmDel"))){await DB.del("transactions",id);await loadAll();render()}
  }
}


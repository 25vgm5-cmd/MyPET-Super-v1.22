"use strict";
function viewHome(v){
  const all=sumTx(S.tx),fin=finalBalance(S.opening,S.tx),neg=x=>x.replace(/^-/,"−");
  const asc=[...S.tx].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  let run=S.opening;const info=new Map();
  asc.forEach((x,i)=>{run+=x.type==="income"?x.cents:-x.cents;info.set(x.id,{n:i+1,bal:run})});
  let rows=[],from="",to="";
  if(asc.length){to=asc[asc.length-1].date;from=addDaysISO(to,-6);rows=asc.filter(x=>x.date>=from).reverse()} // 7 days ending on the latest record
  v.innerHTML=`${S.corrupt?`<div class="msg err">${esc(t("corruptWarn"))} (${S.corrupt})</div>`:""}
  <div class="cards cards3">
   <div class="card"><div class="l">${esc(t("totalIncome"))}</div><div class="v inc">${fmtMoney(all.income)}</div></div>
   <div class="card"><div class="l">${esc(t("totalExpense"))}</div><div class="v exp">${fmtMoney(all.expense)}</div></div>
   <div class="card hl"><div class="l">${esc(t("curBalance"))}</div><div class="v ${fin<0?"exp":""}">${neg(fmtMoney(fin))}</div></div>
  </div>
  <div class="panel noprint" style="margin-bottom:14px"><h2>${esc(t("quick"))}</h2><div class="qa">
   <button type="button" data-qa="income"><span class="qi inc">+</span><b>Add Income</b><span class="s">${esc(t("qaIncome"))}</span></button>
   <button type="button" data-qa="expense"><span class="qi exp">+</span><b>Add Expense</b><span class="s">${esc(t("qaExpense"))}</span></button>
   <button type="button" data-qa="tx"><span class="qi">☷</span><b>${esc(t("viewTx"))}</b><span class="s">${esc(t("qaTx"))}</span></button>
  </div></div>
  <div class="panel"><h2>${esc(t("recent7"))}</h2>
   ${rows.length?`<div class="muted" style="font-size:13px;margin:-4px 0 10px">${fmtDate(from)} to ${fmtDate(to)}</div>
   <div class="tw"><table class="rt"><thead><tr><th class="n">${esc(t("sno"))}</th><th>${esc(t("date"))}</th><th>${esc(t("description"))}</th><th class="r inc">${esc(t("income"))}</th><th class="r exp">${esc(t("expense"))}</th><th class="r">${esc(t("balance"))}</th></tr></thead><tbody>
   ${rows.map(x=>{const i=info.get(x.id),inc=x.type==="income";return `<tr><td class="n">${i.n}</td><td class="d">${fmtDate(x.date)}</td><td class="ds">${esc(x.description)}</td>
    <td class="r inc${inc?"":" z"}">${inc?`<b>${fmtMoney(x.cents)}</b>`:"-"}</td><td class="r exp${inc?" z":""}">${inc?"-":`<b>${fmtMoney(x.cents)}</b>`}</td><td class="r bal"><b>${neg(fmtMoney(i.bal))}</b></td></tr>`}).join("")}
   </tbody></table></div>`:`<div class="empty">${esc(t("noRecent"))}</div>`}</div>`;
  v.querySelectorAll("[data-qa]").forEach(b=>b.onclick=()=>{const k=b.dataset.qa;if(k==="tx")go("transactions");else{S.addType=k;go("add")}});
}


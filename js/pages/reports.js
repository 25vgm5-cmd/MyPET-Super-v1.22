"use strict";
function barChartSVG(items){ // grouped income/expense bars; items=[{label,income,expense}]
  const W=640,H=230,pl=8,pr=8,pt=12,pb=26,max=Math.max(1,...items.map(i=>Math.max(i.income,i.expense)));
  const cw=(W-pl-pr)/items.length,bw=Math.min(26,cw/2-3),ch=H-pt-pb;
  let g="";
  items.forEach((it,k)=>{
    const cx=pl+cw*k+cw/2,hi=Math.round(it.income*ch/max),he=Math.round(it.expense*ch/max);
    g+=`<rect class="bi" x="${(cx-bw-1).toFixed(1)}" y="${pt+ch-hi}" width="${bw.toFixed(1)}" height="${hi}"><title>${esc(it.label)} ${esc(t("income"))}: ${fmtMoney(it.income)}</title></rect>`;
    g+=`<rect class="be" x="${(cx+1).toFixed(1)}" y="${pt+ch-he}" width="${bw.toFixed(1)}" height="${he}"><title>${esc(it.label)} ${esc(t("expense"))}: ${fmtMoney(it.expense)}</title></rect>`;
    g+=`<text class="tx" x="${cx.toFixed(1)}" y="${H-8}" text-anchor="middle">${esc(it.label)}</text>`;
  });
  g+=`<line x1="${pl}" x2="${W-pr}" y1="${pt+ch}" y2="${pt+ch}" stroke="var(--border)"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(t("incVsExp"))}">${g}</svg>
  <div class="row muted" style="font-size:13px"><span><i class="dot" style="background:var(--inc)"></i> ${esc(t("income"))}</span><span><i class="dot" style="background:var(--exp)"></i> ${esc(t("expense"))}</span></div>`;
}
function viewReports(v){
  const R=S.rep,isM=R.mode==="monthly",mn=MONTHS.en;
  const years=[...new Set([...S.tx.map(x=>x.date.slice(0,4)),todayISO().slice(0,4),R.year])].sort();
  let from,to,label;
  if(isM){const r=monthRange(R.month);from=r.from;to=r.to;label=R.month}
  else{from=R.year+"-01-01";to=R.year+"-12-31";label=R.year}
  const per=sumTx(S.tx,from,to),cats=expenseByCategory(S.tx,from,to),fin=balanceUpTo(S.opening,S.tx,to);
  const totalExp=cats.reduce((s,c)=>s+c[1],0),has=S.tx.some(x=>x.date>=from&&x.date<=to);
  let items,table="";
  if(isM){
    items=[{label:label,income:per.income,expense:per.expense}];
    const list=S.tx.filter(x=>x.date>=from&&x.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
    table=`<div class="panel" style="margin-top:14px"><h2>${esc(t("monthlyDetails"))} – ${esc(label)} (${list.length})</h2><table class="det">
     <tr class="h"><th>${esc(t("date"))}</th><th>${esc(t("description"))}</th><th class="r">${esc(t("income"))}</th><th class="r">${esc(t("expense"))}</th></tr>
     ${list.map(x=>`<tr><td class="d" style="white-space:nowrap">${fmtDate(x.date)}</td><td class="m">${esc(x.description)}<div class="muted" style="font-size:12px">${esc(catLabel(x.category))}</div></td>
      <td class="r inc">${x.type==="income"?fmtMoney(x.cents):""}</td><td class="r exp">${x.type==="expense"?fmtMoney(x.cents):""}</td></tr>`).join("")}
     <tr class="t"><td colspan="2"><b>${esc(t("total"))}</b></td><td class="r inc"><b>${fmtMoney(per.income)}</b></td><td class="r exp"><b>${fmtMoney(per.expense)}</b></td></tr>
     </table></div>`;
  }else{
    const mb=monthlyBreakdown(S.tx,R.year);
    items=mb.map((m,i)=>({label:mn[i],income:m.income,expense:m.expense}));
    table=`<div class="panel" style="margin-top:14px"><h2>${esc(t("monthlyComparison"))}</h2><table>
     <tr><th>${esc(t("month"))}</th><th class="r">${esc(t("income"))}</th><th class="r">${esc(t("expense"))}</th><th class="r">${esc(t("netBalance"))}</th></tr>
     ${mb.map((m,i)=>`<tr><td>${esc(mn[i])}</td><td class="r inc">${fmtMoney(m.income)}</td><td class="r exp">${fmtMoney(m.expense)}</td><td class="r ${m.income-m.expense<0?"exp":""}">${fmtMoney(m.income-m.expense)}</td></tr>`).join("")}
     </table></div>`;
  }
  const L=isM?{i:"monthlyIncome",e:"monthlyExpenses",n:"monthlyNet"}:{i:"yearlyIncome",e:"yearlyExpenses",n:"yearlyNet"};
  v.innerHTML=`
  <div class="panel noprint" style="margin-bottom:14px"><div class="filters">
   <div><label>${esc(t("type"))}</label><select id="rm"><option value="monthly" ${isM?"selected":""}>${esc(t("monthlyReport"))}</option><option value="yearly" ${isM?"":"selected"}>${esc(t("yearlyReport"))}</option></select></div>
   <div><label>${esc(t(isM?"month":"year"))}</label>${isM?`<input type="month" id="rp" value="${esc(R.month)}">`:`<select id="rp">${years.map(y=>`<option ${y===R.year?"selected":""}>${y}</option>`).join("")}</select>`}</div>
   <div><label>&nbsp;</label><div class="row"><button class="btn" id="rc">${esc(t("exportCsv"))}</button><button class="btn" id="rpnt">${esc(t("print"))}</button></div></div>
  </div></div>
  <div class="printhead"><b>MyPET Super – ${esc(t(isM?"monthlyReport":"yearlyReport"))}: ${esc(label)}</b></div>
  <div class="cards">
   <div class="card"><div class="l">${esc(t(L.i))}</div><div class="v inc">${fmtMoney(per.income)}</div></div>
   <div class="card"><div class="l">${esc(t(L.e))}</div><div class="v exp">${fmtMoney(per.expense)}</div></div>
   <div class="card"><div class="l">${esc(t(L.n))}</div><div class="v ${per.net<0?"exp":"inc"}">${fmtMoney(per.net)}</div></div>
   ${isM?`<div class="card"><div class="l">${esc(t("monthlyFinal"))}</div><div class="v ${fin<0?"exp":""}">${fmtMoney(fin)}</div></div>`:""}
  </div>
  ${has?`<div class="grid2">
   <div class="panel"><h2>${esc(t("incVsExp"))}</h2>${barChartSVG(items)}</div>
   <div class="panel"><h2>${esc(t("byCat"))}</h2>${cats.length?cats.map(([n,c])=>`<div class="row" style="justify-content:space-between"><span>${esc(catLabel(n))}</span><span>${fmtMoney(c)} · ${(Math.round(c*1000/totalExp)/10).toFixed(1)}%</span></div><div class="bar"><i style="width:${Math.max(2,Math.round(c*100/totalExp))}%"></i></div>`).join(""):`<div class="empty">${esc(t("noData"))}</div>`}</div>
  </div>${table}`:`<div class="panel"><div class="empty">${esc(t("noData"))}</div></div>`}`;
  $("rm").onchange=e=>{R.mode=e.target.value;render()};
  $("rp").onchange=e=>{const val=e.target.value;if(isM){if(/^\d{4}-\d{2}$/.test(val))R.month=val}else R.year=val;render()};
  $("rpnt").onclick=()=>window.print();
  $("rc").onclick=()=>exportCsv(from,to,label);
}
function exportCsv(from,to,label){
  const rows=S.tx.filter(x=>x.date>=from&&x.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  const head=["Date","Type","Category","Description","Amount (EUR)","Payment Method","Notes"];
  const lines=[head.map(csvCell).join(",")];
  for(const x of rows)lines.push([x.date,x.type,csvCell(x.category),csvCell(x.description),
    centsToDecimal(x.type==="income"?x.cents:-x.cents),csvCell(x.method),csvCell(x.notes)].map((c,i)=>i===0||i===1||i===4?c:c).join(","));
  const blob=new Blob(["﻿"+lines.join("\r\n")+"\r\n"],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="MyPET-report-"+label+".csv";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}


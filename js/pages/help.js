"use strict";
function viewHelp(v){
  const H=[
   ["Top bar icons","Use the icons at the top right: Print (prints the current page), Backup, Settings, Theme (Light, Dark, Green, Blue, Gray) and Lock (asks for confirmation first). The date and time are shown next to them."],
   ["Last 5 records","After you save a new entry on the ADD page, the five most recently added records appear below the form so you can check, edit or delete them."],
   ["Adding income","Open ADD, choose ADD INCOME, enter date, amount, category and description, then Save."],
   ["Adding expenses","Choose ADD EXPENSE and follow the same steps. Amounts use up to two decimals, e.g. 12.50."],
   ["Viewing reports","Open REPORTS, choose Monthly or Yearly, then pick the month or year. You will see totals, the Income vs Expenses chart and expenses by category. Use Export CSV to download the period's transactions, or Print for a printable report."],
   ["Importing PDFs","Open IMPORT PDF, choose a text-based bank statement PDF and press Read PDF. Review the extracted rows: correct dates, amounts, descriptions and categories, and untick rows you do not want (for example transfers between your own accounts). Rows marked as possible duplicates or uncertain are unselected by default. Nothing is saved until you press Import selected and confirm. Scanned PDFs are not supported."],
   ["Creating / restoring backups","Open BACKUP. To create one, choose a backup password (at least 8 characters) and download the encrypted file. To restore, select the file, enter its password, check the preview, then confirm. A safety backup of your current data is downloaded first. Passwords cannot be recovered if you forget them, so store them safely and keep backup files in more than one place."]];
  v.innerHTML=`<div class="panel">${H.map(([a,b])=>`<h2>${esc(a)}</h2><p class="muted">${esc(b)}</p>`).join("")}</div>`;
}


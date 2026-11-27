MyPET Super v1.22 - split version
=================================
index.html          -> app shell (nav, top bar, lock screen, dialog) + script tags
css/style.css       -> all styles

js/core/            -> shared code (every page uses these)
  config.js           texts (EN), categories, themes, NAV list
  calc.js             money / date / report calculations
  security.js         encryption (password, backup file)
  pdf-parser.js       bank-statement PDF text -> transactions
  database.js         IndexedDB
  state.js            app state S, t(), esc()
  ui-helpers.js       dialogs, date input, txRow
  router.js           nav, go(), render()

js/pages/           -> ONE FILE PER PAGE
  home.js             HOME (dashboard)
  add.js              ADD (+ Manage Categories dialog, Last 5 records)
  transactions.js     TRANSACTIONS
  reports.js          REPORTS (+ CSV export)
  import.js           IMPORT PDF
  backup.js           BACKUP / RESTORE
  help.js             HELP
  settings.js         Settings dialog
  lock.js             Login / lock / password / erase

js/main.js          -> startup (must stay LAST)

Important
- Keep the folder structure as it is. Script ORDER in index.html matters (core -> pages -> main.js).
- Open through a local web server or HTTPS (not file://), same as the original app.
  Example:  python3 -m http.server 8000   then open http://localhost:8000/
- For PDF import, put pdf.min.mjs and pdf.worker.min.mjs in a LIBRARY folder next to index.html.
- Only change vs original: the PDF.js import path now uses document.baseURI, because
  an external .js file resolves "./" relative to the js file, not the page.

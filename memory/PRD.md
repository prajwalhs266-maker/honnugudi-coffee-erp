# Honnugudi Coffee Trading ERP — PRD

## Original Problem Statement
Web-based ERP (on-premise, LAN-first) for Honnugudi Traders — coffee middleman digitizing 40 years of trading. Strict dual-ledger core (Stock Ledger in KG, Party Ledger in INR) with symmetric BUY/SELL HOLD-SOLD model. Buys from growers, stores across godowns, dispatches to curing works. No deletes ever — reversals only. Money as integer paise, quantities fixed-precision (integer grams). React + FastAPI + MongoDB.

## User Choices
- JWT-based custom auth (email/password, roles: admin/operator/finance)
- Full v1 core scope in first build; vouchers/backup/Kannada deferred
- Seeded admin: prajwalhs266@gmail.com / admin123
- Logo: user said they'd upload but no asset was retrievable — text letterhead used for now
- Design: designer's choice (Organic Earthy + Swiss fusion, espresso/parchment palette, Manrope/Inter/JetBrains Mono)

## Architecture
- Backend: FastAPI, files: server.py (app+startup), core.py (db, helpers, balances), auth.py (JWT cookies + Bearer, PERMS RBAC, brute-force lockout, admin seed), masters.py, transactions.py, reports.py
- Ledgers: append-only collections `stock_ledger` & `party_ledger`; balances always derived via aggregation (back-dating safe by design)
- Party ledger sign convention: positive = party owes us (receivable), negative = we owe (payable)
- Units: money integer paise; qty integer grams; rate = paise per kg; amount = round(qty_g * rate_paise / 1000)
- Numbering: PB/DS/AD/ST/PY + counter collection
- Audit log on every write; reversals post counter ledger entries with reason
- Frontend: React (JS), shadcn/ui, sonner, SearchSelect (Popover+Command), pages: Login, Dashboard, Purchases, Dispatches, Advances, Settlements, Payments, Ledgers, Masters

## Implemented (June 2026 — MVP, tested 39/39 backend + frontend smoke)
- Auth + roles (admin/operator/finance), users management (admin)
- Masters: parties (grower/curing_works/other), products, godowns, seasons
- Purchase bills: multi-item, per-line SOLD (editable ₹/kg) or HOLD (rate disabled); stock inflow; party credit for SOLD
- Buy advances (party debit), buy settlements (partial/full, open HOLD items, advance auto-applied, net payable, stock untouched)
- Dispatches: only stock outflow, per product+godown stock validation, SOLD/HOLD
- Sell advances (party credit), sell settlements (mirror of buy side)
- Payments IN/OUT cash/bank
- Reversals (admin, reason mandatory, counter entries, guards: settled items block bill reversal, stock-negative check)
- Daily market rate (admin sets from dashboard)
- Dashboard KPIs: physical stock, unpriced HOLD both sides, exposure at market rate, cover ratio, advances both directions, payables/receivables, stock-by-product-godown
- Ledger views: party ledger w/ running balance, stock ledger w/ filters, all balances

## Backlog (prioritized)
- P0: Printable vouchers with logo (English + Kannada) — awaiting logo upload
- P0: Backup & restore (local disk + pen drive)
- P1: CSV/Excel exports (ledgers, transactions)
- P1: FY carry-forward / season close workflow
- P1: Keyboard shortcuts (Alt+N/S/A/D per design guidelines)
- P2: Audit log viewer UI (endpoint /api/audit-log exists)
- P2: Reports section (season-wise P&L view, party statements)
- P2: Password change UI for own account

## Test Assets
- Backend regression: /app/backend/tests/backend_test.py (run with `-n 0`, serialised)
- Credentials: /app/memory/test_credentials.md

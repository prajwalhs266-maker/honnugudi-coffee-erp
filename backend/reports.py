from fastapi import APIRouter, Depends
from core import db
from auth import require

router = APIRouter(tags=["reports"])


async def hold_unpriced(coll: str):
    pipeline = [
        {"$match": {"reversed": False}},
        {"$unwind": "$items"},
        {"$match": {"items.mode": "HOLD"}},
        {"$project": {"rem": {"$subtract": ["$items.qty_g", {"$ifNull": ["$items.settled_qty_g", 0]}]}}},
        {"$match": {"rem": {"$gt": 0}}},
        {"$group": {"_id": None, "qty": {"$sum": "$rem"}}},
    ]
    res = await db[coll].aggregate(pipeline).to_list(1)
    return res[0]["qty"] if res else 0


async def advances_total(side: str):
    adv = await db.advances.aggregate([
        {"$match": {"side": side, "reversed": False}},
        {"$group": {"_id": None, "amt": {"$sum": "$amount_paise"}}}]).to_list(1)
    applied = await db.settlements.aggregate([
        {"$match": {"side": side, "reversed": False}},
        {"$group": {"_id": None, "amt": {"$sum": "$advance_applied_paise"}}}]).to_list(1)
    return max(0, (adv[0]["amt"] if adv else 0) - (applied[0]["amt"] if applied else 0))


@router.get("/stock/summary")
async def stock_summary(user: dict = Depends(require("dashboard:read"))):
    pipeline = [
        {"$group": {"_id": {"product_id": "$product_id", "godown_id": "$godown_id",
                            "product_name": "$product_name", "godown_name": "$godown_name"},
                    "qty_g": {"$sum": "$qty_g"}}},
        {"$match": {"qty_g": {"$ne": 0}}},
        {"$sort": {"_id.product_name": 1, "_id.godown_name": 1}},
    ]
    rows = await db.stock_ledger.aggregate(pipeline).to_list(500)
    return [{"product_id": r["_id"]["product_id"], "product_name": r["_id"]["product_name"],
             "godown_id": r["_id"]["godown_id"], "godown_name": r["_id"]["godown_name"],
             "qty_g": r["qty_g"]} for r in rows]


@router.get("/dashboard")
async def dashboard(user: dict = Depends(require("dashboard:read"))):
    stock_rows = await db.stock_ledger.aggregate([
        {"$group": {"_id": None, "qty": {"$sum": "$qty_g"}}}]).to_list(1)
    physical_stock_g = stock_rows[0]["qty"] if stock_rows else 0

    buy_hold_g = await hold_unpriced("purchases")
    sell_hold_g = await hold_unpriced("dispatches")

    buy_adv = await advances_total("BUY")
    sell_adv = await advances_total("SELL")

    balances = await db.party_ledger.aggregate([
        {"$group": {"_id": "$party_id", "bal": {"$sum": "$amount_paise"}}}]).to_list(2000)
    receivables = sum(b["bal"] for b in balances if b["bal"] > 0)
    payables = -sum(b["bal"] for b in balances if b["bal"] < 0)

    rate_doc = await db.market_rates.find_one(sort=[("date", -1)])
    market_rate = rate_doc["rate_paise"] if rate_doc else None
    market_rate_date = rate_doc["date"] if rate_doc else None

    buy_exposure = round(buy_hold_g * market_rate / 1000) if market_rate else None
    sell_exposure = round(sell_hold_g * market_rate / 1000) if market_rate else None
    cover_ratio = round(physical_stock_g / buy_hold_g, 2) if buy_hold_g > 0 else None

    return {
        "physical_stock_g": physical_stock_g,
        "buy_hold_unpriced_g": buy_hold_g,
        "sell_hold_unpriced_g": sell_hold_g,
        "stock_cover_ratio": cover_ratio,
        "buy_advances_outstanding_paise": buy_adv,
        "sell_advances_outstanding_paise": sell_adv,
        "receivables_paise": receivables,
        "payables_paise": payables,
        "market_rate_paise": market_rate,
        "market_rate_date": market_rate_date,
        "buy_exposure_paise": buy_exposure,
        "sell_exposure_paise": sell_exposure,
    }


@router.get("/ledgers/stock")
async def stock_ledger(product_id: str | None = None, godown_id: str | None = None,
                       user: dict = Depends(require("ledger:read"))):
    match = {}
    if product_id:
        match["product_id"] = product_id
    if godown_id:
        match["godown_id"] = godown_id
    docs = await db.stock_ledger.find(match).sort([("date", 1), ("created_at", 1)]).to_list(2000)
    running = 0
    rows = []
    for d in docs:
        running += d["qty_g"]
        rows.append({"id": str(d["_id"]), "date": d["date"], "product_name": d["product_name"],
                     "godown_name": d["godown_name"], "qty_g": d["qty_g"], "ref_type": d["ref_type"],
                     "ref_no": d.get("ref_no"), "balance_g": running})
    rows.reverse()
    return {"entries": rows, "balance_g": running}


@router.get("/ledgers/party/{party_id}")
async def party_ledger(party_id: str, user: dict = Depends(require("ledger:read"))):
    docs = await db.party_ledger.find({"party_id": party_id}).sort([("date", 1), ("created_at", 1)]).to_list(2000)
    running = 0
    rows = []
    for d in docs:
        running += d["amount_paise"]
        rows.append({"id": str(d["_id"]), "date": d["date"], "amount_paise": d["amount_paise"],
                     "ref_type": d["ref_type"], "ref_no": d.get("ref_no"),
                     "narration": d.get("narration"), "balance_paise": running})
    rows.reverse()
    return {"entries": rows, "balance_paise": running}


@router.get("/parties/balances")
async def party_balances(user: dict = Depends(require("ledger:read"))):
    rows = await db.party_ledger.aggregate([
        {"$group": {"_id": {"party_id": "$party_id", "party_name": "$party_name"},
                    "bal": {"$sum": "$amount_paise"}}},
        {"$sort": {"_id.party_name": 1}},
    ]).to_list(2000)
    return [{"party_id": r["_id"]["party_id"], "party_name": r["_id"]["party_name"],
             "balance_paise": r["bal"]} for r in rows]


@router.get("/audit-log")
async def audit_log(limit: int = 100, user: dict = Depends(require("reversal:write"))):
    docs = await db.audit_log.find().sort("ts", -1).to_list(min(limit, 500))
    return [{"id": str(d.pop("_id")), **d} for d in docs]

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core import db, now_iso, audit, next_number, stock_balance, outstanding_advance
from auth import require

router = APIRouter(tags=["transactions"])

SIDES = ["BUY", "SELL"]
MODES = ["SOLD", "HOLD"]


class ItemBody(BaseModel):
    product_id: str
    godown_id: str
    qty_g: int
    mode: str
    rate_paise: int | None = None


class PurchaseBody(BaseModel):
    party_id: str
    date: str
    season_id: str | None = None
    notes: str | None = None
    items: list[ItemBody]


class DispatchBody(BaseModel):
    party_id: str
    date: str
    season_id: str | None = None
    vehicle: str | None = None
    notes: str | None = None
    items: list[ItemBody]


class AdvanceBody(BaseModel):
    side: str
    party_id: str
    date: str
    amount_paise: int
    method: str = "CASH"
    notes: str | None = None


class SettleItemBody(BaseModel):
    ref_id: str
    item_index: int
    qty_g: int
    rate_paise: int


class SettlementBody(BaseModel):
    side: str
    party_id: str
    date: str
    notes: str | None = None
    items: list[SettleItemBody]


class PaymentBody(BaseModel):
    party_id: str
    date: str
    direction: str
    method: str = "CASH"
    amount_paise: int
    notes: str | None = None


class ReversalBody(BaseModel):
    ref_type: str
    ref_id: str
    reason: str


def line_amount(qty_g: int, rate_paise: int) -> int:
    return round(qty_g * rate_paise / 1000)


def out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


async def get_names(items: list[ItemBody]):
    names = {}
    for it in items:
        for coll, key in [("products", it.product_id), ("godowns", it.godown_id)]:
            if (coll, key) not in names:
                doc = await db[coll].find_one({"_id": ObjectId(key)})
                if not doc:
                    raise HTTPException(status_code=400, detail=f"Invalid {coll[:-1]} id")
                names[(coll, key)] = doc["name"]
    return names


async def get_party(party_id: str) -> dict:
    p = await db.parties.find_one({"_id": ObjectId(party_id)})
    if not p:
        raise HTTPException(status_code=400, detail="Invalid party")
    return p


def validate_items(items: list[ItemBody]):
    if not items:
        raise HTTPException(status_code=400, detail="At least one item required")
    for it in items:
        if it.mode not in MODES:
            raise HTTPException(status_code=400, detail="Item mode must be SOLD or HOLD")
        if it.qty_g <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        if it.mode == "SOLD" and (not it.rate_paise or it.rate_paise <= 0):
            raise HTTPException(status_code=400, detail="SOLD items require a positive rate")


async def post_stock(entries: list[dict]):
    if entries:
        await db.stock_ledger.insert_many(entries)


async def post_party(entries: list[dict]):
    if entries:
        await db.party_ledger.insert_many(entries)


@router.post("/purchases")
async def create_purchase(body: PurchaseBody, user: dict = Depends(require("purchase:write"))):
    validate_items(body.items)
    party = await get_party(body.party_id)
    names = await get_names(body.items)
    bill_no = await next_number("PB")
    items, total = [], 0
    for it in body.items:
        amt = line_amount(it.qty_g, it.rate_paise) if it.mode == "SOLD" else 0
        total += amt
        items.append({"product_id": it.product_id, "product_name": names[("products", it.product_id)],
                      "godown_id": it.godown_id, "godown_name": names[("godowns", it.godown_id)],
                      "qty_g": it.qty_g, "mode": it.mode,
                      "rate_paise": it.rate_paise if it.mode == "SOLD" else None,
                      "amount_paise": amt, "settled_qty_g": 0})
    doc = {"bill_no": bill_no, "party_id": body.party_id, "party_name": party["name"], "date": body.date,
           "season_id": body.season_id, "notes": body.notes, "items": items, "total_paise": total,
           "reversed": False, "created_by": user["email"], "created_at": now_iso()}
    res = await db.purchases.insert_one(doc)
    rid = str(res.inserted_id)
    stock_entries = [{"date": body.date, "product_id": i["product_id"], "product_name": i["product_name"],
                      "godown_id": i["godown_id"], "godown_name": i["godown_name"], "qty_g": i["qty_g"],
                      "ref_type": "purchase", "ref_id": rid, "ref_no": bill_no,
                      "created_at": now_iso(), "reversal_of": None} for i in items]
    await post_stock(stock_entries)
    if total > 0:
        await post_party([{"date": body.date, "party_id": body.party_id, "party_name": party["name"],
                           "amount_paise": -total, "ref_type": "purchase", "ref_id": rid, "ref_no": bill_no,
                           "narration": f"Purchase bill {bill_no} (SOLD items)",
                           "created_at": now_iso(), "reversal_of": None}])
    await audit(user, "create", "purchase", rid, {"bill_no": bill_no, "total_paise": total})
    doc["_id"] = res.inserted_id
    return out(doc)


@router.get("/purchases")
async def list_purchases(party_id: str | None = None, user: dict = Depends(require("tx:read"))):
    match = {"party_id": party_id} if party_id else {}
    docs = await db.purchases.find(match).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [out(d) for d in docs]


@router.post("/dispatches")
async def create_dispatch(body: DispatchBody, user: dict = Depends(require("dispatch:write"))):
    validate_items(body.items)
    party = await get_party(body.party_id)
    names = await get_names(body.items)
    need = {}
    for it in body.items:
        need[(it.product_id, it.godown_id)] = need.get((it.product_id, it.godown_id), 0) + it.qty_g
    for (pid, gid), qty in need.items():
        bal = await stock_balance(pid, gid)
        if bal < qty:
            raise HTTPException(status_code=400, detail=(
                f"Insufficient stock: {names[('products', pid)]} at {names[('godowns', gid)]} "
                f"has {bal/1000:.2f} kg, need {qty/1000:.2f} kg"))
    disp_no = await next_number("DS")
    items, total = [], 0
    for it in body.items:
        amt = line_amount(it.qty_g, it.rate_paise) if it.mode == "SOLD" else 0
        total += amt
        items.append({"product_id": it.product_id, "product_name": names[("products", it.product_id)],
                      "godown_id": it.godown_id, "godown_name": names[("godowns", it.godown_id)],
                      "qty_g": it.qty_g, "mode": it.mode,
                      "rate_paise": it.rate_paise if it.mode == "SOLD" else None,
                      "amount_paise": amt, "settled_qty_g": 0})
    doc = {"dispatch_no": disp_no, "party_id": body.party_id, "party_name": party["name"], "date": body.date,
           "season_id": body.season_id, "vehicle": body.vehicle, "notes": body.notes, "items": items,
           "total_paise": total, "reversed": False, "created_by": user["email"], "created_at": now_iso()}
    res = await db.dispatches.insert_one(doc)
    rid = str(res.inserted_id)
    stock_entries = [{"date": body.date, "product_id": i["product_id"], "product_name": i["product_name"],
                      "godown_id": i["godown_id"], "godown_name": i["godown_name"], "qty_g": -i["qty_g"],
                      "ref_type": "dispatch", "ref_id": rid, "ref_no": disp_no,
                      "created_at": now_iso(), "reversal_of": None} for i in items]
    await post_stock(stock_entries)
    if total > 0:
        await post_party([{"date": body.date, "party_id": body.party_id, "party_name": party["name"],
                           "amount_paise": total, "ref_type": "dispatch", "ref_id": rid, "ref_no": disp_no,
                           "narration": f"Dispatch {disp_no} (SOLD items)",
                           "created_at": now_iso(), "reversal_of": None}])
    await audit(user, "create", "dispatch", rid, {"dispatch_no": disp_no, "total_paise": total})
    doc["_id"] = res.inserted_id
    return out(doc)


@router.get("/dispatches")
async def list_dispatches(party_id: str | None = None, user: dict = Depends(require("tx:read"))):
    match = {"party_id": party_id} if party_id else {}
    docs = await db.dispatches.find(match).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [out(d) for d in docs]


@router.post("/advances")
async def create_advance(body: AdvanceBody, user: dict = Depends(require("advance:write"))):
    if body.side not in SIDES:
        raise HTTPException(status_code=400, detail="Side must be BUY or SELL")
    if body.amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    party = await get_party(body.party_id)
    adv_no = await next_number("AD")
    doc = {"advance_no": adv_no, "side": body.side, "party_id": body.party_id, "party_name": party["name"],
           "date": body.date, "amount_paise": body.amount_paise, "method": body.method, "notes": body.notes,
           "reversed": False, "created_by": user["email"], "created_at": now_iso()}
    res = await db.advances.insert_one(doc)
    rid = str(res.inserted_id)
    signed = body.amount_paise if body.side == "BUY" else -body.amount_paise
    narr = (f"Advance {adv_no} paid to grower" if body.side == "BUY"
            else f"Advance {adv_no} received from curing works")
    await post_party([{"date": body.date, "party_id": body.party_id, "party_name": party["name"],
                       "amount_paise": signed, "ref_type": "advance", "ref_id": rid, "ref_no": adv_no,
                       "narration": narr, "created_at": now_iso(), "reversal_of": None}])
    await audit(user, "create", "advance", rid, {"advance_no": adv_no, "side": body.side, "amount_paise": body.amount_paise})
    doc["_id"] = res.inserted_id
    return out(doc)


@router.get("/advances")
async def list_advances(side: str | None = None, party_id: str | None = None,
                        user: dict = Depends(require("tx:read"))):
    match = {}
    if side:
        match["side"] = side
    if party_id:
        match["party_id"] = party_id
    docs = await db.advances.find(match).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [out(d) for d in docs]


@router.get("/settlements/open-items")
async def open_items(side: str, party_id: str, user: dict = Depends(require("tx:read"))):
    coll, no_key = ("purchases", "bill_no") if side == "BUY" else ("dispatches", "dispatch_no")
    docs = await db[coll].find({"party_id": party_id, "reversed": False}).sort("date", 1).to_list(500)
    items = []
    for d in docs:
        for idx, it in enumerate(d["items"]):
            remaining = it["qty_g"] - it.get("settled_qty_g", 0)
            if it["mode"] == "HOLD" and remaining > 0:
                items.append({"ref_id": str(d["_id"]), "ref_no": d[no_key], "date": d["date"],
                              "item_index": idx, "product_name": it["product_name"],
                              "godown_name": it["godown_name"], "qty_g": it["qty_g"],
                              "remaining_g": remaining})
    adv = await outstanding_advance(side, party_id)
    return {"items": items, "outstanding_advance_paise": adv}


@router.post("/settlements")
async def create_settlement(body: SettlementBody, user: dict = Depends(require("settlement:write"))):
    if body.side not in SIDES:
        raise HTTPException(status_code=400, detail="Side must be BUY or SELL")
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item required")
    party = await get_party(body.party_id)
    coll = db.purchases if body.side == "BUY" else db.dispatches
    resolved, gross = [], 0
    for si in body.items:
        if si.qty_g <= 0 or si.rate_paise <= 0:
            raise HTTPException(status_code=400, detail="Quantity and rate must be positive")
        ref = await coll.find_one({"_id": ObjectId(si.ref_id)})
        if not ref or ref.get("reversed") or ref["party_id"] != body.party_id:
            raise HTTPException(status_code=400, detail="Invalid reference document")
        if si.item_index >= len(ref["items"]):
            raise HTTPException(status_code=400, detail="Invalid item index")
        item = ref["items"][si.item_index]
        if item["mode"] != "HOLD":
            raise HTTPException(status_code=400, detail="Only HOLD items can be settled")
        remaining = item["qty_g"] - item.get("settled_qty_g", 0)
        if si.qty_g > remaining:
            raise HTTPException(status_code=400, detail=(
                f"Settling {si.qty_g/1000:.2f} kg but only {remaining/1000:.2f} kg remains unsettled"))
        amt = line_amount(si.qty_g, si.rate_paise)
        gross += amt
        ref_no = ref.get("bill_no") or ref.get("dispatch_no")
        resolved.append({"ref_id": si.ref_id, "ref_no": ref_no, "item_index": si.item_index,
                         "product_name": item["product_name"], "qty_g": si.qty_g,
                         "rate_paise": si.rate_paise, "amount_paise": amt})
    adv_outstanding = await outstanding_advance(body.side, body.party_id)
    advance_applied = min(adv_outstanding, gross)
    net = gross - advance_applied
    st_no = await next_number("ST")
    doc = {"settlement_no": st_no, "side": body.side, "party_id": body.party_id, "party_name": party["name"],
           "date": body.date, "notes": body.notes, "items": resolved, "gross_paise": gross,
           "advance_applied_paise": advance_applied, "net_paise": net,
           "reversed": False, "created_by": user["email"], "created_at": now_iso()}
    res = await db.settlements.insert_one(doc)
    rid = str(res.inserted_id)
    for si in body.items:
        await coll.update_one({"_id": ObjectId(si.ref_id)},
                              {"$inc": {f"items.{si.item_index}.settled_qty_g": si.qty_g}})
    signed = -gross if body.side == "BUY" else gross
    narr = (f"Settlement {st_no}: price fixed for HOLD purchase" if body.side == "BUY"
            else f"Settlement {st_no}: sale price fixed for dispatched coffee")
    await post_party([{"date": body.date, "party_id": body.party_id, "party_name": party["name"],
                       "amount_paise": signed, "ref_type": "settlement", "ref_id": rid, "ref_no": st_no,
                       "narration": narr, "created_at": now_iso(), "reversal_of": None}])
    await audit(user, "create", "settlement", rid,
                {"settlement_no": st_no, "side": body.side, "gross_paise": gross,
                 "advance_applied_paise": advance_applied})
    doc["_id"] = res.inserted_id
    return out(doc)


@router.get("/settlements")
async def list_settlements(side: str | None = None, party_id: str | None = None,
                           user: dict = Depends(require("tx:read"))):
    match = {}
    if side:
        match["side"] = side
    if party_id:
        match["party_id"] = party_id
    docs = await db.settlements.find(match).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [out(d) for d in docs]


@router.post("/payments")
async def create_payment(body: PaymentBody, user: dict = Depends(require("payment:write"))):
    if body.direction not in ["IN", "OUT"]:
        raise HTTPException(status_code=400, detail="Direction must be IN or OUT")
    if body.amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    party = await get_party(body.party_id)
    pay_no = await next_number("PY")
    doc = {"payment_no": pay_no, "party_id": body.party_id, "party_name": party["name"], "date": body.date,
           "direction": body.direction, "method": body.method, "amount_paise": body.amount_paise,
           "notes": body.notes, "reversed": False, "created_by": user["email"], "created_at": now_iso()}
    res = await db.payments.insert_one(doc)
    rid = str(res.inserted_id)
    signed = body.amount_paise if body.direction == "OUT" else -body.amount_paise
    narr = f"Payment {pay_no} {'paid to' if body.direction == 'OUT' else 'received from'} {party['name']} ({body.method})"
    await post_party([{"date": body.date, "party_id": body.party_id, "party_name": party["name"],
                       "amount_paise": signed, "ref_type": "payment", "ref_id": rid, "ref_no": pay_no,
                       "narration": narr, "created_at": now_iso(), "reversal_of": None}])
    await audit(user, "create", "payment", rid, {"payment_no": pay_no, "direction": body.direction,
                                                 "amount_paise": body.amount_paise})
    doc["_id"] = res.inserted_id
    return out(doc)


@router.get("/payments")
async def list_payments(party_id: str | None = None, user: dict = Depends(require("tx:read"))):
    match = {"party_id": party_id} if party_id else {}
    docs = await db.payments.find(match).sort([("date", -1), ("created_at", -1)]).to_list(500)
    return [out(d) for d in docs]


REF_COLLECTIONS = {"purchase": "purchases", "dispatch": "dispatches", "advance": "advances",
                   "settlement": "settlements", "payment": "payments"}


@router.post("/reversals")
async def create_reversal(body: ReversalBody, user: dict = Depends(require("reversal:write"))):
    if body.ref_type not in REF_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Invalid ref_type")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required")
    coll = db[REF_COLLECTIONS[body.ref_type]]
    doc = await coll.find_one({"_id": ObjectId(body.ref_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.get("reversed"):
        raise HTTPException(status_code=400, detail="Already reversed")
    if body.ref_type in ["purchase", "dispatch"]:
        for it in doc["items"]:
            if it.get("settled_qty_g", 0) > 0:
                raise HTTPException(status_code=400, detail=(
                    "This document has settled items. Reverse the related settlement(s) first."))
    if body.ref_type == "purchase":
        for it in doc["items"]:
            bal = await stock_balance(it["product_id"], it["godown_id"])
            if bal < it["qty_g"]:
                raise HTTPException(status_code=400, detail=(
                    f"Cannot reverse: stock of {it['product_name']} at {it['godown_name']} would go negative"))
    if body.ref_type == "settlement":
        src = db.purchases if doc["side"] == "BUY" else db.dispatches
        for it in doc["items"]:
            await src.update_one({"_id": ObjectId(it["ref_id"])},
                                 {"$inc": {f"items.{it['item_index']}.settled_qty_g": -it["qty_g"]}})
    ts = now_iso()
    stock_entries = await db.stock_ledger.find({"ref_id": body.ref_id, "reversal_of": None}).to_list(100)
    party_entries = await db.party_ledger.find({"ref_id": body.ref_id, "reversal_of": None}).to_list(100)
    for e in stock_entries:
        eid = str(e.pop("_id"))
        e.update({"qty_g": -e["qty_g"], "ref_type": f"{e['ref_type']}_reversal", "reversal_of": eid,
                  "created_at": ts})
        await db.stock_ledger.insert_one(e)
    for e in party_entries:
        eid = str(e.pop("_id"))
        e.update({"amount_paise": -e["amount_paise"], "ref_type": f"{e['ref_type']}_reversal",
                  "narration": f"REVERSAL: {e['narration']} — {body.reason}", "reversal_of": eid,
                  "created_at": ts})
        await db.party_ledger.insert_one(e)
    await coll.update_one({"_id": ObjectId(body.ref_id)},
                          {"$set": {"reversed": True, "reversed_reason": body.reason,
                                    "reversed_by": user["email"], "reversed_at": ts}})
    await audit(user, "reverse", body.ref_type, body.ref_id, {"reason": body.reason})
    return {"ok": True, "reversed": body.ref_id}

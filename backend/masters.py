from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core import db, now_iso, audit
from auth import require

router = APIRouter(tags=["masters"])

PARTY_TYPES = ["grower", "curing_works", "other"]


class PartyBody(BaseModel):
    name: str
    type: str
    phone: str | None = None
    village: str | None = None
    notes: str | None = None
    active: bool = True


class SimpleBody(BaseModel):
    name: str
    notes: str | None = None
    active: bool = True


class SeasonBody(BaseModel):
    name: str
    start_date: str
    end_date: str
    active: bool = True


class MarketRateBody(BaseModel):
    date: str
    rate_paise: int
    notes: str | None = None


def out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


async def _list(coll, extra_match=None):
    match = extra_match or {}
    docs = await db[coll].find(match).sort("name", 1).to_list(1000)
    return [out(d) for d in docs]


async def _create(coll, data: dict, user: dict):
    data["created_at"] = now_iso()
    res = await db[coll].insert_one(data)
    await audit(user, "create", coll, str(res.inserted_id), {"name": data.get("name")})
    doc = await db[coll].find_one({"_id": res.inserted_id})
    return out(doc)


async def _update(coll, doc_id: str, data: dict, user: dict):
    res = await db[coll].find_one_and_update({"_id": ObjectId(doc_id)}, {"$set": data})
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    await audit(user, "update", coll, doc_id, data)
    doc = await db[coll].find_one({"_id": ObjectId(doc_id)})
    return out(doc)


@router.get("/parties")
async def list_parties(type: str | None = None, user: dict = Depends(require("masters:read"))):
    match = {"type": type} if type else {}
    return await _list("parties", match)


@router.post("/parties")
async def create_party(body: PartyBody, user: dict = Depends(require("masters:write"))):
    if body.type not in PARTY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid party type")
    return await _create("parties", body.model_dump(), user)


@router.patch("/parties/{party_id}")
async def update_party(party_id: str, body: PartyBody, user: dict = Depends(require("masters:write"))):
    if body.type not in PARTY_TYPES:
        raise HTTPException(status_code=400, detail="Invalid party type")
    return await _update("parties", party_id, body.model_dump(), user)


@router.get("/products")
async def list_products(user: dict = Depends(require("masters:read"))):
    return await _list("products")


@router.post("/products")
async def create_product(body: SimpleBody, user: dict = Depends(require("masters:write"))):
    return await _create("products", body.model_dump(), user)


@router.patch("/products/{doc_id}")
async def update_product(doc_id: str, body: SimpleBody, user: dict = Depends(require("masters:write"))):
    return await _update("products", doc_id, body.model_dump(), user)


@router.get("/godowns")
async def list_godowns(user: dict = Depends(require("masters:read"))):
    return await _list("godowns")


@router.post("/godowns")
async def create_godown(body: SimpleBody, user: dict = Depends(require("masters:write"))):
    return await _create("godowns", body.model_dump(), user)


@router.patch("/godowns/{doc_id}")
async def update_godown(doc_id: str, body: SimpleBody, user: dict = Depends(require("masters:write"))):
    return await _update("godowns", doc_id, body.model_dump(), user)


@router.get("/seasons")
async def list_seasons(user: dict = Depends(require("masters:read"))):
    docs = await db.seasons.find().sort("start_date", -1).to_list(100)
    return [out(d) for d in docs]


@router.post("/seasons")
async def create_season(body: SeasonBody, user: dict = Depends(require("season:write"))):
    return await _create("seasons", body.model_dump(), user)


@router.patch("/seasons/{doc_id}")
async def update_season(doc_id: str, body: SeasonBody, user: dict = Depends(require("season:write"))):
    return await _update("seasons", doc_id, body.model_dump(), user)


@router.get("/market-rates")
async def list_market_rates(user: dict = Depends(require("dashboard:read"))):
    docs = await db.market_rates.find().sort("date", -1).to_list(30)
    return [out(d) for d in docs]


@router.post("/market-rates")
async def set_market_rate(body: MarketRateBody, user: dict = Depends(require("market_rate:write"))):
    if body.rate_paise <= 0:
        raise HTTPException(status_code=400, detail="Rate must be positive")
    data = body.model_dump()
    data["set_by"] = user["email"]
    data["created_at"] = now_iso()
    await db.market_rates.update_one({"date": body.date}, {"$set": data}, upsert=True)
    await audit(user, "set", "market_rate", body.date, {"rate_paise": body.rate_paise})
    doc = await db.market_rates.find_one({"date": body.date})
    return out(doc)

import os
from datetime import datetime, timezone
from typing import Optional, Annotated, List
from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, Field
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

PyObjectId = Annotated[str, BeforeValidator(str)]


def now():
    return datetime.now(timezone.utc)


def now_iso():
    return now().isoformat()


class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    model_config = {"populate_by_name": True}

    def to_mongo(self) -> dict:
        d = self.model_dump(by_alias=True)
        d.pop("_id", None)
        return d

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None


async def next_number(prefix: str) -> str:
    c = await db.counters.find_one_and_update(
        {"_id": prefix}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"{prefix}-{c['seq']:05d}"


async def audit(user: dict, action: str, ref_type: str, ref_id: str, details: dict = None):
    await db.audit_log.insert_one({
        "ts": now_iso(), "user_id": user.get("_id"), "user_email": user.get("email"),
        "action": action, "ref_type": ref_type, "ref_id": ref_id, "details": details or {},
    })


async def stock_balance(product_id: str = None, godown_id: str = None) -> int:
    match = {}
    if product_id:
        match["product_id"] = product_id
    if godown_id:
        match["godown_id"] = godown_id
    pipeline = [{"$match": match}, {"$group": {"_id": None, "qty": {"$sum": "$qty_g"}}}]
    res = await db.stock_ledger.aggregate(pipeline).to_list(1)
    return res[0]["qty"] if res else 0


async def party_balance(party_id: str) -> int:
    pipeline = [{"$match": {"party_id": party_id}}, {"$group": {"_id": None, "amt": {"$sum": "$amount_paise"}}}]
    res = await db.party_ledger.aggregate(pipeline).to_list(1)
    return res[0]["amt"] if res else 0


async def outstanding_advance(side: str, party_id: str) -> int:
    adv = await db.advances.aggregate([
        {"$match": {"side": side, "party_id": party_id, "reversed": False}},
        {"$group": {"_id": None, "amt": {"$sum": "$amount_paise"}}},
    ]).to_list(1)
    applied = await db.settlements.aggregate([
        {"$match": {"side": side, "party_id": party_id, "reversed": False}},
        {"$group": {"_id": None, "amt": {"$sum": "$advance_applied_paise"}}},
    ]).to_list(1)
    total_adv = adv[0]["amt"] if adv else 0
    total_applied = applied[0]["amt"] if applied else 0
    return max(0, total_adv - total_applied)

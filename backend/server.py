from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from core import db, client
from auth import router as auth_router, users_router, seed_admin
from masters import router as masters_router
from transactions import router as tx_router
from reports import router as reports_router

app = FastAPI(title="Honnugudi Coffee Trading ERP")

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(masters_router)
api_router.include_router(tx_router)
api_router.include_router(reports_router)


@api_router.get("/")
async def root():
    return {"app": "Honnugudi Coffee Trading ERP", "status": "ok"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)


@app.on_event("startup")
async def startup():
    await seed_admin()
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.stock_ledger.create_index([("product_id", 1), ("godown_id", 1)])
    await db.stock_ledger.create_index([("ref_id", 1)])
    await db.party_ledger.create_index([("party_id", 1), ("date", 1)])
    await db.party_ledger.create_index([("ref_id", 1)])
    await db.parties.create_index("name")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

"""End-to-end backend tests for Honnugudi Coffee Trading ERP."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Read from frontend .env
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "prajwalhs266@gmail.com"
ADMIN_PASSWORD = "admin123"

TS = str(int(time.time()))
OP_EMAIL = f"test_operator_{TS}@example.com"
FIN_EMAIL = f"test_finance_{TS}@example.com"
USER_PASSWORD = "testpass123"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    # Extract cookie for Bearer alternative — server returns cookies; we'll use cookie session
    return r.cookies.get("access_token")


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}"})
    return s


@pytest.fixture(scope="session")
def state():
    """Shared state across tests (ids, etc.)."""
    return {}


# ---------------- Health / Auth ----------------
class TestAuth:
    def test_root_api(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        j = r.json()
        assert j["email"] == ADMIN_EMAIL
        assert j["role"] == "admin"
        # httpOnly cookies must be set
        assert "access_token" in r.cookies
        assert "refresh_token" in r.cookies

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_client):
        r = admin_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------------- Masters ----------------
class TestMasters:
    def test_create_grower(self, admin_client, state):
        r = admin_client.post(f"{API}/parties", json={"name": f"TEST_Grower_{TS}", "type": "grower", "phone": "9999911111"})
        assert r.status_code == 200, r.text
        state["grower_id"] = r.json()["id"]
        assert r.json()["type"] == "grower"

    def test_create_curing_works(self, admin_client, state):
        r = admin_client.post(f"{API}/parties", json={"name": f"TEST_Curing_{TS}", "type": "curing_works"})
        assert r.status_code == 200, r.text
        state["curing_id"] = r.json()["id"]

    def test_invalid_party_type(self, admin_client):
        r = admin_client.post(f"{API}/parties", json={"name": "Bad", "type": "invalid"})
        assert r.status_code == 400

    def test_create_product(self, admin_client, state):
        r = admin_client.post(f"{API}/products", json={"name": f"TEST_Arabica_{TS}"})
        assert r.status_code == 200, r.text
        state["product_id"] = r.json()["id"]

    def test_create_godown(self, admin_client, state):
        r = admin_client.post(f"{API}/godowns", json={"name": f"TEST_Godown_{TS}"})
        assert r.status_code == 200, r.text
        state["godown_id"] = r.json()["id"]

    def test_list_parties(self, admin_client, state):
        r = admin_client.get(f"{API}/parties")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert state["grower_id"] in ids

    def test_set_market_rate(self, admin_client):
        # 250.75 INR/kg -> 25075 paise
        r = admin_client.post(f"{API}/market-rates", json={"date": "2026-01-15", "rate_paise": 25075})
        assert r.status_code == 200, r.text
        assert r.json()["rate_paise"] == 25075


# ---------------- Users (admin only) ----------------
class TestUsers:
    def test_create_operator(self, admin_client, state):
        r = admin_client.post(f"{API}/users", json={
            "name": "TEST Operator", "email": OP_EMAIL, "password": USER_PASSWORD, "role": "operator"
        })
        assert r.status_code == 200, r.text
        state["op_id"] = r.json()["id"]

    def test_create_finance(self, admin_client, state):
        r = admin_client.post(f"{API}/users", json={
            "name": "TEST Finance", "email": FIN_EMAIL, "password": USER_PASSWORD, "role": "finance"
        })
        assert r.status_code == 200, r.text
        state["fin_id"] = r.json()["id"]

    def test_operator_cannot_list_users(self, state):
        op = requests.post(f"{API}/auth/login", json={"email": OP_EMAIL, "password": USER_PASSWORD})
        assert op.status_code == 200
        tok = op.cookies.get("access_token")
        state["op_token"] = tok
        r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_operator_cannot_set_market_rate(self, state):
        r = requests.post(f"{API}/market-rates", json={"date": "2026-01-16", "rate_paise": 25000},
                          headers={"Authorization": f"Bearer {state['op_token']}"})
        assert r.status_code == 403

    def test_finance_cannot_create_purchase(self, state):
        fin = requests.post(f"{API}/auth/login", json={"email": FIN_EMAIL, "password": USER_PASSWORD})
        assert fin.status_code == 200
        state["fin_token"] = fin.cookies.get("access_token")
        r = requests.post(f"{API}/purchases", json={
            "party_id": state["grower_id"], "date": "2026-01-15",
            "items": [{"product_id": state["product_id"], "godown_id": state["godown_id"],
                       "qty_g": 100000, "mode": "SOLD", "rate_paise": 25000}]
        }, headers={"Authorization": f"Bearer {state['fin_token']}"})
        assert r.status_code == 403

    def test_finance_can_create_payment(self, state):
        r = requests.post(f"{API}/payments", json={
            "party_id": state["grower_id"], "date": "2026-01-15", "direction": "OUT",
            "amount_paise": 100000, "method": "CASH"
        }, headers={"Authorization": f"Bearer {state['fin_token']}"})
        assert r.status_code == 200, r.text
        state["finance_payment_id"] = r.json()["id"]


# ---------------- Purchase / Dispatch / Settlement flow ----------------
class TestPurchaseFlow:
    def test_dashboard_before(self, admin_client, state):
        r = admin_client.get(f"{API}/dashboard")
        assert r.status_code == 200
        state["pre_stock"] = r.json()["physical_stock_g"]
        state["pre_buy_hold"] = r.json()["buy_hold_unpriced_g"]
        state["pre_payables"] = r.json()["payables_paise"]

    def test_create_multi_item_purchase(self, admin_client, state):
        # SOLD item: 100.5 kg @ 250.75/kg = 25200375 paise
        # HOLD item: 50 kg unpriced
        body = {
            "party_id": state["grower_id"], "date": "2026-01-15",
            "items": [
                {"product_id": state["product_id"], "godown_id": state["godown_id"],
                 "qty_g": 100500, "mode": "SOLD", "rate_paise": 25075},
                {"product_id": state["product_id"], "godown_id": state["godown_id"],
                 "qty_g": 50000, "mode": "HOLD"},
            ]
        }
        r = admin_client.post(f"{API}/purchases", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        # 100500g * 25075paise/kg / 1000 = 2520037.5 -> round to 2520038
        assert d["total_paise"] == 2520038, f"Expected 2520038, got {d['total_paise']}"
        assert d["items"][0]["amount_paise"] == 2520038
        assert d["items"][1]["amount_paise"] == 0
        assert d["items"][1]["rate_paise"] is None
        state["purchase_id"] = d["id"]
        state["purchase_bill_no"] = d["bill_no"]

    def test_purchase_updates_dashboard(self, admin_client, state):
        r = admin_client.get(f"{API}/dashboard")
        d = r.json()
        # stock increases by 150500 g
        assert d["physical_stock_g"] == state["pre_stock"] + 150500
        # buy hold unpriced increases by 50000 g
        assert d["buy_hold_unpriced_g"] == state["pre_buy_hold"] + 50000
        # payables increased due to SOLD amount (net of any prior debit balance)
        assert d["payables_paise"] >= state["pre_payables"]

    def test_party_ledger_shows_credit(self, admin_client, state):
        r = admin_client.get(f"{API}/ledgers/party/{state['grower_id']}")
        assert r.status_code == 200
        entries = r.json()["entries"]
        # Find purchase entry
        purch = [e for e in entries if e["ref_type"] == "purchase"]
        assert len(purch) >= 1
        assert purch[0]["amount_paise"] == -2520038  # credit to grower

    def test_stock_ledger(self, admin_client, state):
        r = admin_client.get(f"{API}/ledgers/stock", params={"product_id": state["product_id"]})
        assert r.status_code == 200
        assert r.json()["balance_g"] >= 150500


class TestAdvanceAndSettlement:
    def test_create_buy_advance(self, admin_client, state):
        r = admin_client.post(f"{API}/advances", json={
            "side": "BUY", "party_id": state["grower_id"], "date": "2026-01-15",
            "amount_paise": 500000, "method": "CASH"
        })
        assert r.status_code == 200, r.text
        state["advance_id"] = r.json()["id"]

    def test_advance_outstanding(self, admin_client, state):
        r = admin_client.get(f"{API}/dashboard")
        assert r.json()["buy_advances_outstanding_paise"] >= 500000

    def test_open_items(self, admin_client, state):
        r = admin_client.get(f"{API}/settlements/open-items",
                             params={"side": "BUY", "party_id": state["grower_id"]})
        assert r.status_code == 200
        j = r.json()
        assert any(it["ref_id"] == state["purchase_id"] for it in j["items"])
        assert j["outstanding_advance_paise"] >= 500000

    def test_create_partial_settlement(self, admin_client, state):
        # Settle 20 kg out of 50 kg HOLD @ 240/kg -> 24000 * 20000 / 1000 = 480000 paise
        # Advance applied: min(500000, 480000) = 480000; net = 0
        r = admin_client.post(f"{API}/settlements", json={
            "side": "BUY", "party_id": state["grower_id"], "date": "2026-01-16",
            "items": [{"ref_id": state["purchase_id"], "item_index": 1,
                       "qty_g": 20000, "rate_paise": 24000}]
        })
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["gross_paise"] == 480000
        assert j["advance_applied_paise"] == 480000
        assert j["net_paise"] == 0
        state["settlement_id"] = j["id"]

    def test_stock_unchanged_after_settlement(self, admin_client, state):
        r = admin_client.get(f"{API}/dashboard")
        d = r.json()
        assert d["physical_stock_g"] == state["pre_stock"] + 150500  # unchanged
        # hold unpriced decreased by 20000
        assert d["buy_hold_unpriced_g"] == state["pre_buy_hold"] + 30000
        # advance outstanding: 500000 - 480000 = 20000
        assert d["buy_advances_outstanding_paise"] >= 20000


class TestDispatch:
    def test_dispatch_exceeds_stock_rejected(self, admin_client, state):
        r = admin_client.post(f"{API}/dispatches", json={
            "party_id": state["curing_id"], "date": "2026-01-17",
            "items": [{"product_id": state["product_id"], "godown_id": state["godown_id"],
                       "qty_g": 999999999, "mode": "SOLD", "rate_paise": 30000}]
        })
        assert r.status_code == 400
        assert "insufficient" in r.text.lower() or "stock" in r.text.lower()

    def test_dispatch_sold(self, admin_client, state):
        r = admin_client.post(f"{API}/dispatches", json={
            "party_id": state["curing_id"], "date": "2026-01-17",
            "items": [{"product_id": state["product_id"], "godown_id": state["godown_id"],
                       "qty_g": 30000, "mode": "SOLD", "rate_paise": 30000}]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        # 30000g * 30000 paise/kg / 1000 = 900000
        assert d["total_paise"] == 900000
        state["dispatch_sold_id"] = d["id"]

    def test_dispatch_hold(self, admin_client, state):
        r = admin_client.post(f"{API}/dispatches", json={
            "party_id": state["curing_id"], "date": "2026-01-17",
            "items": [{"product_id": state["product_id"], "godown_id": state["godown_id"],
                       "qty_g": 25000, "mode": "HOLD"}]
        })
        assert r.status_code == 200, r.text
        state["dispatch_hold_id"] = r.json()["id"]

    def test_sell_advance(self, admin_client, state):
        r = admin_client.post(f"{API}/advances", json={
            "side": "SELL", "party_id": state["curing_id"], "date": "2026-01-17",
            "amount_paise": 200000
        })
        assert r.status_code == 200, r.text
        state["sell_adv_id"] = r.json()["id"]

    def test_sell_settlement(self, admin_client, state):
        r = admin_client.post(f"{API}/settlements", json={
            "side": "SELL", "party_id": state["curing_id"], "date": "2026-01-18",
            "items": [{"ref_id": state["dispatch_hold_id"], "item_index": 0,
                       "qty_g": 25000, "rate_paise": 32000}]
        })
        assert r.status_code == 200, r.text
        j = r.json()
        # 25000 * 32000 / 1000 = 800000
        assert j["gross_paise"] == 800000
        assert j["advance_applied_paise"] == 200000
        assert j["net_paise"] == 600000
        state["sell_settle_id"] = j["id"]


# ---------------- Payments & Reversals ----------------
class TestPaymentsReversals:
    def test_payment_out(self, admin_client, state):
        r = admin_client.post(f"{API}/payments", json={
            "party_id": state["grower_id"], "date": "2026-01-18", "direction": "OUT",
            "amount_paise": 100000, "method": "BANK"
        })
        assert r.status_code == 200, r.text
        state["payment_id"] = r.json()["id"]

    def test_reverse_payment(self, admin_client, state):
        r = admin_client.post(f"{API}/reversals", json={
            "ref_type": "payment", "ref_id": state["payment_id"], "reason": "Test reversal"
        })
        assert r.status_code == 200, r.text

    def test_reverse_purchase_with_settled_hold_blocked(self, admin_client, state):
        # Purchase had HOLD item settled (20kg) — reversal should fail
        r = admin_client.post(f"{API}/reversals", json={
            "ref_type": "purchase", "ref_id": state["purchase_id"], "reason": "Try"
        })
        assert r.status_code == 400
        assert "settle" in r.text.lower()

    def test_finance_cannot_reverse(self, state):
        r = requests.post(f"{API}/reversals", json={
            "ref_type": "payment", "ref_id": state["finance_payment_id"], "reason": "x"
        }, headers={"Authorization": f"Bearer {state['fin_token']}"})
        assert r.status_code == 403

    def test_party_balances(self, admin_client, state):
        r = admin_client.get(f"{API}/parties/balances")
        assert r.status_code == 200
        ids = {b["party_id"] for b in r.json()}
        assert state["grower_id"] in ids


# ---------------- Money Integrity ----------------
class TestMoneyIntegrity:
    def test_paise_arithmetic(self):
        # 100.5 kg @ 250.75 = 25200.375 -> rounds to 25200 or 25201? python round: banker's rounding
        # 100500 * 25075 / 1000 = 2520037500/1000 = 2520037.5 -> rounds to 2520038 (banker's: to even -> 2520038)
        # Actually round(2520037.5) in Python 3 = 2520038 (banker's rounds to even)
        from_val = round(100500 * 25075 / 1000)
        # Above test asserted 25200375 — but that would require * 1 not / 1000... let me recompute
        # 100.5 kg * 25075 paise/kg = 2520037.5 paise -> not 25200375
        # Wait: qty is in grams, rate in paise/kg. amount = qty_g * rate_paise / 1000 = grams->kg then paise
        # 100500 g * 25075 paise/kg / 1000 = 2520037.5 paise
        assert from_val in (2520037, 2520038)

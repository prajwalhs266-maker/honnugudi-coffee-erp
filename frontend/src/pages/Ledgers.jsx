import { useEffect, useState } from "react";
import { api, fmtINR, fmtKG } from "@/lib/api";
import { SearchSelect } from "@/components/SearchSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const Th = ({ children, right }) => (
  <th className={`px-4 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>{children}</th>
);

const RefBadge = ({ t }) => (
  <Badge variant="outline" className={`border-[#E5D9C8] text-[10px] uppercase ${t.includes("reversal") ? "text-rose-700 border-rose-200" : "text-slate-600"}`}>
    {t.replace("_", " ")}
  </Badge>
);

const PartyLedgerTab = () => {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/parties").then((r) => setParties(r.data)); }, []);
  useEffect(() => {
    if (partyId) api.get(`/ledgers/party/${partyId}`).then((r) => setData(r.data));
    else setData(null);
  }, [partyId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-72">
          <SearchSelect options={parties.map((p) => ({ value: p.id, label: p.name, sub: p.type }))}
            value={partyId} onChange={setPartyId} placeholder="Select party..." testId="ledger-party-select" />
        </div>
        {data && (
          <div className="text-sm">
            Balance:{" "}
            <span className={`font-mono font-bold text-lg ${data.balance_paise >= 0 ? "text-emerald-700" : "text-rose-700"}`} data-testid="party-ledger-balance">
              {fmtINR(Math.abs(data.balance_paise))} {data.balance_paise > 0 ? "receivable" : data.balance_paise < 0 ? "payable" : ""}
            </span>
          </div>
        )}
      </div>
      {data && (
        <div className="bg-white border border-[#E5D9C8] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
                <Th>Date</Th><Th>Ref</Th><Th>Type</Th><Th>Narration</Th><Th right>Amount</Th><Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={e.id} className={i % 2 ? "bg-[#FDFBF7]" : ""} data-testid={`party-ledger-row-${i}`}>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{e.date}</td>
                  <td className="px-4 py-2.5 font-mono">{e.ref_no}</td>
                  <td className="px-4 py-2.5"><RefBadge t={e.ref_type} /></td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{e.narration}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${e.amount_paise >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtINR(e.amount_paise)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold">{fmtINR(e.balance_paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No entries for this party.</div>}
        </div>
      )}
      {!partyId && <div className="text-sm text-slate-500 py-8 text-center">Select a party to view their ledger. Positive = they owe us, negative = we owe them.</div>}
    </div>
  );
};

const StockLedgerTab = () => {
  const [products, setProducts] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [productId, setProductId] = useState("");
  const [godownId, setGodownId] = useState("");
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data));
    api.get("/godowns").then((r) => setGodowns(r.data));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (productId) params.set("product_id", productId);
    if (godownId) params.set("godown_id", godownId);
    api.get(`/ledgers/stock?${params}`).then((r) => setData(r.data));
  }, [productId, godownId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-56">
          <SearchSelect options={[{ value: "", label: "All products" }, ...products.map((p) => ({ value: p.id, label: p.name }))]}
            value={productId} onChange={setProductId} placeholder="All products" testId="stock-ledger-product-select" />
        </div>
        <div className="w-56">
          <SearchSelect options={[{ value: "", label: "All godowns" }, ...godowns.map((g) => ({ value: g.id, label: g.name }))]}
            value={godownId} onChange={setGodownId} placeholder="All godowns" testId="stock-ledger-godown-select" />
        </div>
        {data && <div className="text-sm">Balance: <span className="font-mono font-bold text-lg text-amber-900" data-testid="stock-ledger-balance">{fmtKG(data.balance_g)}</span></div>}
      </div>
      {data && (
        <div className="bg-white border border-[#E5D9C8] rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
                <Th>Date</Th><Th>Ref</Th><Th>Type</Th><Th>Product</Th><Th>Godown</Th><Th right>Qty</Th><Th right>Running</Th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={e.id} className={i % 2 ? "bg-[#FDFBF7]" : ""} data-testid={`stock-ledger-row-${i}`}>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{e.date}</td>
                  <td className="px-4 py-2.5 font-mono">{e.ref_no}</td>
                  <td className="px-4 py-2.5"><RefBadge t={e.ref_type} /></td>
                  <td className="px-4 py-2.5">{e.product_name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{e.godown_name}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${e.qty_g >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtKG(e.qty_g)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-amber-900">{fmtKG(e.balance_g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No stock movements yet.</div>}
        </div>
      )}
    </div>
  );
};

const BalancesTab = () => {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/parties/balances").then((r) => setRows(r.data)); }, []);
  return (
    <div className="bg-white border border-[#E5D9C8] rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
            <Th>Party</Th><Th right>Balance</Th><Th>Position</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.party_id} className={i % 2 ? "bg-[#FDFBF7]" : ""} data-testid={`balance-row-${r.party_id}`}>
              <td className="px-4 py-2.5 font-medium">{r.party_name}</td>
              <td className={`px-4 py-2.5 text-right font-mono font-bold ${r.balance_paise >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{fmtINR(Math.abs(r.balance_paise))}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{r.balance_paise > 0 ? "Owes us (receivable)" : r.balance_paise < 0 ? "We owe (payable)" : "Settled"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No party balances yet.</div>}
    </div>
  );
};

export default function Ledgers() {
  return (
    <div className="space-y-6" data-testid="ledgers-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Ledgers</h1>
        <p className="text-sm text-slate-500 mt-1">Append-only entries. Balances always derived, never hand-edited.</p>
      </div>
      <Tabs defaultValue="party">
        <TabsList className="bg-[#F2EBE0]">
          <TabsTrigger value="party" data-testid="tab-party-ledger">Party Ledger</TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock-ledger">Stock Ledger</TabsTrigger>
          <TabsTrigger value="balances" data-testid="tab-balances">All Balances</TabsTrigger>
        </TabsList>
        <TabsContent value="party" className="mt-4"><PartyLedgerTab /></TabsContent>
        <TabsContent value="stock" className="mt-4"><StockLedgerTab /></TabsContent>
        <TabsContent value="balances" className="mt-4"><BalancesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

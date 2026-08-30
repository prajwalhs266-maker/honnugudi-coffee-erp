import { useEffect, useState, useCallback } from "react";
import { api, fmtINR, fmtKG, fmtRate, toPaise, toGrams, today, errMsg } from "@/lib/api";
import { SearchSelect } from "@/components/SearchSelect";
import { ReverseButton } from "@/components/ReverseButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const ModeBadge = ({ mode }) => (
  <Badge className={mode === "SOLD" ? "bg-[#CCFBF1] text-[#115E59] hover:bg-[#CCFBF1]" : "bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7]"}>{mode}</Badge>
);

const emptyItem = () => ({ product_id: "", godown_id: "", qty: "", mode: "SOLD", rate: "" });

export const BillForm = ({ kind, partyType, onSaved }) => {
  const isBuy = kind === "purchase";
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState([]);
  const [products, setProducts] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [stock, setStock] = useState([]);
  const [form, setForm] = useState({ party_id: "", date: today(), notes: "" });
  const [items, setItems] = useState([emptyItem()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get(`/parties?type=${partyType}`).then((r) => setParties(r.data.filter((p) => p.active)));
    api.get("/products").then((r) => setProducts(r.data.filter((p) => p.active)));
    api.get("/godowns").then((r) => setGodowns(r.data.filter((p) => p.active)));
    if (!isBuy) api.get("/stock/summary").then((r) => setStock(r.data));
  }, [open, partyType, isBuy]);

  const setItem = (i, patch) => setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const total = items.reduce((s, it) => (it.mode === "SOLD" && it.qty && it.rate ? s + Math.round(toGrams(it.qty) * toPaise(it.rate) / 1000) : s), 0);

  const stockHint = (it) => {
    if (isBuy || !it.product_id || !it.godown_id) return null;
    const row = stock.find((s) => s.product_id === it.product_id && s.godown_id === it.godown_id);
    return `Available: ${fmtKG(row?.qty_g || 0)}`;
  };

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        ...form,
        items: items.map((it) => ({
          product_id: it.product_id, godown_id: it.godown_id, qty_g: toGrams(it.qty),
          mode: it.mode, rate_paise: it.mode === "SOLD" ? toPaise(it.rate) : null,
        })),
      };
      const { data } = await api.post(isBuy ? "/purchases" : "/dispatches", payload);
      toast.success(`${isBuy ? "Purchase bill" : "Dispatch"} ${data.bill_no || data.dispatch_no} saved`);
      setOpen(false);
      setForm({ party_id: "", date: today(), notes: "" });
      setItems([emptyItem()]);
      onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const valid = form.party_id && items.every((it) => it.product_id && it.godown_id && parseFloat(it.qty) > 0 && (it.mode === "HOLD" || parseFloat(it.rate) > 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={`btn-new-${kind}`} className="bg-[#2C1810] hover:bg-[#1E100B] text-white">
          <Plus className="h-4 w-4 mr-1.5" /> New {isBuy ? "Purchase Bill" : "Dispatch"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">{isBuy ? "New Purchase Bill" : "New Curing Dispatch"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{isBuy ? "Grower" : "Curing Works"}</Label>
            <SearchSelect options={parties.map((p) => ({ value: p.id, label: p.name, sub: p.village }))}
              value={form.party_id} onChange={(v) => setForm({ ...form, party_id: v })} placeholder={`Select ${isBuy ? "grower" : "curing works"}...`} testId={`${kind}-party-select`} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" data-testid={`${kind}-date-input`} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Items</Label>
          {items.map((it, i) => (
            <div key={i} className="border border-[#E5D9C8] rounded-md p-3 bg-[#FDFBF7] space-y-2" data-testid={`${kind}-item-row-${i}`}>
              <div className="grid grid-cols-2 gap-2">
                <SearchSelect options={products.map((p) => ({ value: p.id, label: p.name }))} value={it.product_id}
                  onChange={(v) => setItem(i, { product_id: v })} placeholder="Product..." testId={`${kind}-item-${i}-product`} />
                <SearchSelect options={godowns.map((g) => ({ value: g.id, label: g.name }))} value={it.godown_id}
                  onChange={(v) => setItem(i, { godown_id: v })} placeholder="Godown..." testId={`${kind}-item-${i}-godown`} />
              </div>
              <div className="flex gap-2 items-center">
                <Input placeholder="Qty (kg)" data-testid={`${kind}-item-${i}-qty`} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} className="w-28 bg-white" />
                <div className="flex rounded-md overflow-hidden border border-[#E5D9C8]">
                  {["SOLD", "HOLD"].map((m) => (
                    <button key={m} type="button" data-testid={`${kind}-item-${i}-mode-${m.toLowerCase()}`}
                      onClick={() => setItem(i, { mode: m, rate: m === "HOLD" ? "" : it.rate })}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${it.mode === m
                        ? m === "SOLD" ? "bg-teal-600 text-white" : "bg-amber-600 text-white"
                        : "bg-white text-slate-500 hover:bg-[#F5EFE6]"}`}>{m}</button>
                  ))}
                </div>
                <Input placeholder="Rate ₹/kg" data-testid={`${kind}-item-${i}-rate`} value={it.rate} disabled={it.mode === "HOLD"}
                  onChange={(e) => setItem(i, { rate: e.target.value })} className="w-28 bg-white disabled:bg-stone-100" />
                <div className="flex-1 text-right font-mono text-sm font-semibold text-slate-700">
                  {it.mode === "SOLD" && it.qty && it.rate ? fmtINR(Math.round(toGrams(it.qty) * toPaise(it.rate) / 1000)) : it.mode === "HOLD" ? "Unpriced" : ""}
                </div>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {stockHint(it) && <div className="text-xs text-amber-800 font-mono">{stockHint(it)}</div>}
            </div>
          ))}
          <Button variant="outline" size="sm" data-testid={`${kind}-add-item-btn`} className="border-[#E5D9C8]" onClick={() => setItems([...items, emptyItem()])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add item
          </Button>
        </div>
        <div className="flex items-center justify-between border-t border-[#E5D9C8] pt-3">
          <div className="text-sm text-slate-500">SOLD total: <span className="font-mono font-bold text-slate-900">{fmtINR(total)}</span></div>
          <Button data-testid={`${kind}-save-btn`} className="bg-[#2C1810] hover:bg-[#1E100B] text-white" disabled={!valid || busy} onClick={submit}>
            {busy ? "Saving..." : `Save ${isBuy ? "Bill" : "Dispatch"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const BillList = ({ kind, docs, onChanged }) => {
  const isBuy = kind === "purchase";
  return (
    <div className="space-y-3">
      {docs.length === 0 && <div className="bg-white border border-[#E5D9C8] rounded-lg px-5 py-10 text-center text-sm text-slate-500">No {isBuy ? "purchase bills" : "dispatches"} yet.</div>}
      {docs.map((d) => (
        <div key={d.id} className={`bg-white border rounded-lg ${d.reversed ? "border-rose-200 opacity-60" : "border-[#E5D9C8]"}`} data-testid={`${kind}-card-${d.id}`}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#F2EBE0]">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-slate-900">{d.bill_no || d.dispatch_no}</span>
              <span className="text-sm text-slate-600">{d.party_name}</span>
              <span className="text-xs text-slate-400 font-mono">{d.date}</span>
              {d.reversed && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">REVERSED</Badge>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-semibold text-sm">{fmtINR(d.total_paise)}</span>
              {!d.reversed && !d.items.some((it) => it.settled_qty_g > 0) && (
                <ReverseButton refType={kind} refId={d.id} refNo={d.bill_no || d.dispatch_no} onDone={onChanged} />
              )}
            </div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {d.items.map((it, i) => (
                <tr key={i} className={i % 2 ? "bg-[#FDFBF7]" : ""}>
                  <td className="px-4 py-2">{it.product_name}</td>
                  <td className="px-2 py-2 text-slate-500">{it.godown_name}</td>
                  <td className="px-2 py-2 font-mono font-semibold text-amber-900 text-right">{fmtKG(it.qty_g)}</td>
                  <td className="px-2 py-2 text-center"><ModeBadge mode={it.mode} /></td>
                  <td className="px-2 py-2 font-mono text-right text-slate-600">{it.mode === "SOLD" ? fmtRate(it.rate_paise) : it.settled_qty_g > 0 ? `${fmtKG(it.settled_qty_g)} settled` : "unpriced"}</td>
                  <td className="px-4 py-2 font-mono text-right font-semibold">{it.mode === "SOLD" ? fmtINR(it.amount_paise) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
};

export default function Purchases() {
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api.get("/purchases").then((r) => setDocs(r.data)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-6" data-testid="purchases-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Purchase Bills</h1>
          <p className="text-sm text-slate-500 mt-1">Coffee in from growers. SOLD = rate fixed now, HOLD = priced later via settlement.</p>
        </div>
        <BillForm kind="purchase" partyType="grower" onSaved={load} />
      </div>
      <BillList kind="purchase" docs={docs} onChanged={load} />
    </div>
  );
}

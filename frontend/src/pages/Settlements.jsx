import { useEffect, useState, useCallback } from "react";
import { api, fmtINR, fmtKG, toPaise, toGrams, today, errMsg } from "@/lib/api";
import { SearchSelect } from "@/components/SearchSelect";
import { ReverseButton } from "@/components/ReverseButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const SettleDialog = ({ side, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(today());
  const [openItems, setOpenItems] = useState([]);
  const [advance, setAdvance] = useState(0);
  const [lines, setLines] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get(`/parties?type=${side === "BUY" ? "grower" : "curing_works"}`).then((r) => setParties(r.data.filter((p) => p.active)));
  }, [open, side]);

  useEffect(() => {
    if (!partyId) { setOpenItems([]); setAdvance(0); setLines({}); return; }
    api.get(`/settlements/open-items?side=${side}&party_id=${partyId}`).then((r) => {
      setOpenItems(r.data.items);
      setAdvance(r.data.outstanding_advance_paise);
      setLines({});
    });
  }, [partyId, side]);

  const key = (it) => `${it.ref_id}:${it.item_index}`;
  const setLine = (it, patch) => setLines({ ...lines, [key(it)]: { ...(lines[key(it)] || { qty: "", rate: "" }), ...patch } });

  const selected = openItems
    .map((it) => ({ it, l: lines[key(it)] }))
    .filter(({ l }) => l && parseFloat(l.qty) > 0 && parseFloat(l.rate) > 0);
  const gross = selected.reduce((s, { l }) => s + Math.round(toGrams(l.qty) * toPaise(l.rate) / 1000), 0);
  const applied = Math.min(advance, gross);
  const net = gross - applied;

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/settlements", {
        side, party_id: partyId, date,
        items: selected.map(({ it, l }) => ({
          ref_id: it.ref_id, item_index: it.item_index, qty_g: toGrams(l.qty), rate_paise: toPaise(l.rate),
        })),
      });
      toast.success(`Settlement ${data.settlement_no} saved · Net ${fmtINR(data.net_paise)}`);
      setOpen(false); setPartyId(""); setLines({});
      onSaved();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="btn-new-settlement" className="bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1.5" /> New Settlement</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">New {side === "BUY" ? "Buy-side" : "Sell-side"} Settlement</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{side === "BUY" ? "Grower" : "Curing Works"}</Label>
            <SearchSelect options={parties.map((p) => ({ value: p.id, label: p.name, sub: p.village }))}
              value={partyId} onChange={setPartyId} testId="settlement-party-select" />
          </div>
          <div><Label>Date</Label><Input type="date" data-testid="settlement-date-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        {partyId && (
          <>
            <div className="text-sm text-slate-600">
              Outstanding advance: <span className="font-mono font-bold text-slate-900" data-testid="settlement-outstanding-advance">{fmtINR(advance)}</span>
            </div>
            {openItems.length === 0 ? (
              <div className="border border-dashed border-[#E5D9C8] rounded-md px-4 py-8 text-center text-sm text-slate-500">
                No open HOLD items for this party.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Open HOLD items — enter qty & rate to settle</Label>
                {openItems.map((it) => {
                  const l = lines[key(it)] || { qty: "", rate: "" };
                  return (
                    <div key={key(it)} className="border border-[#E5D9C8] rounded-md p-3 bg-[#FDFBF7] flex flex-wrap items-center gap-3" data-testid={`settle-item-${it.ref_id}-${it.item_index}`}>
                      <div className="min-w-[180px]">
                        <div className="font-mono font-semibold text-sm">{it.ref_no} · {it.product_name}</div>
                        <div className="text-xs text-slate-500">{it.date} · {it.godown_name} · remaining <span className="font-mono font-bold text-amber-900">{fmtKG(it.remaining_g)}</span></div>
                      </div>
                      <Input placeholder="Qty kg" data-testid={`settle-qty-${it.ref_id}-${it.item_index}`} value={l.qty} onChange={(e) => setLine(it, { qty: e.target.value })} className="w-28 bg-white" />
                      <Input placeholder="Rate ₹/kg" data-testid={`settle-rate-${it.ref_id}-${it.item_index}`} value={l.rate} onChange={(e) => setLine(it, { rate: e.target.value })} className="w-28 bg-white" />
                      <div className="flex-1 text-right font-mono text-sm font-semibold">
                        {parseFloat(l.qty) > 0 && parseFloat(l.rate) > 0 ? fmtINR(Math.round(toGrams(l.qty) * toPaise(l.rate) / 1000)) : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="border-t border-[#E5D9C8] pt-3 grid grid-cols-3 gap-3 text-sm">
              <div>Gross<div className="font-mono font-bold text-lg" data-testid="settlement-gross">{fmtINR(gross)}</div></div>
              <div>Advance applied<div className="font-mono font-bold text-lg text-amber-800" data-testid="settlement-advance-applied">{fmtINR(applied)}</div></div>
              <div>{side === "BUY" ? "Net payable" : "Net receivable"}<div className="font-mono font-bold text-lg text-emerald-700" data-testid="settlement-net">{fmtINR(net)}</div></div>
            </div>
            <Button data-testid="settlement-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white" disabled={selected.length === 0 || busy} onClick={submit}>
              {busy ? "Saving..." : "Save Settlement"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function Settlements() {
  const [side, setSide] = useState("BUY");
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api.get(`/settlements?side=${side}`).then((r) => setDocs(r.data)), [side]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="settlements-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Settlements</h1>
          <p className="text-sm text-slate-500 mt-1">Fix price for HOLD coffee — full or partial. Never touches stock.</p>
        </div>
        <SettleDialog side={side} onSaved={load} />
      </div>

      <Tabs value={side} onValueChange={setSide}>
        <TabsList className="bg-[#F2EBE0]">
          <TabsTrigger value="BUY" data-testid="settlements-tab-buy">BUY · Grower Settlements</TabsTrigger>
          <TabsTrigger value="SELL" data-testid="settlements-tab-sell">SELL · Curing Works Settlements</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {docs.length === 0 && <div className="bg-white border border-[#E5D9C8] rounded-lg px-5 py-10 text-center text-sm text-slate-500">No {side} settlements yet.</div>}
        {docs.map((d) => (
          <div key={d.id} className={`bg-white border rounded-lg ${d.reversed ? "border-rose-200 opacity-60" : "border-[#E5D9C8]"}`} data-testid={`settlement-card-${d.id}`}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#F2EBE0]">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">{d.settlement_no}</span>
                <span className="text-sm text-slate-600">{d.party_name}</span>
                <span className="text-xs text-slate-400 font-mono">{d.date}</span>
                {d.reversed && <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">REVERSED</Badge>}
              </div>
              <div className="flex items-center gap-4 text-sm font-mono">
                <span>Gross <b>{fmtINR(d.gross_paise)}</b></span>
                <span className="text-amber-800">Adv <b>{fmtINR(d.advance_applied_paise)}</b></span>
                <span className="text-emerald-700">Net <b>{fmtINR(d.net_paise)}</b></span>
                {!d.reversed && <ReverseButton refType="settlement" refId={d.id} refNo={d.settlement_no} onDone={load} />}
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {d.items.map((it, i) => (
                  <tr key={i} className={i % 2 ? "bg-[#FDFBF7]" : ""}>
                    <td className="px-4 py-2 font-mono">{it.ref_no}</td>
                    <td className="px-2 py-2">{it.product_name}</td>
                    <td className="px-2 py-2 font-mono text-right text-amber-900 font-semibold">{fmtKG(it.qty_g)}</td>
                    <td className="px-2 py-2 font-mono text-right text-slate-600">₹{(it.rate_paise / 100).toFixed(2)}/kg</td>
                    <td className="px-4 py-2 font-mono text-right font-semibold">{fmtINR(it.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

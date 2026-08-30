import { useEffect, useState, useCallback } from "react";
import { api, fmtINR, toPaise, today, errMsg } from "@/lib/api";
import { SearchSelect } from "@/components/SearchSelect";
import { ReverseButton } from "@/components/ReverseButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Advances() {
  const [side, setSide] = useState("BUY");
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState({ party_id: "", date: today(), amount: "", method: "CASH", notes: "" });

  const load = useCallback(() => api.get(`/advances?side=${side}`).then((r) => setDocs(r.data)), [side]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!open) return;
    api.get(`/parties?type=${side === "BUY" ? "grower" : "curing_works"}`).then((r) => setParties(r.data.filter((p) => p.active)));
  }, [open, side]);

  const save = async () => {
    try {
      const { data } = await api.post("/advances", {
        side, party_id: form.party_id, date: form.date,
        amount_paise: toPaise(form.amount), method: form.method, notes: form.notes,
      });
      toast.success(`Advance ${data.advance_no} recorded`);
      setOpen(false); setForm({ party_id: "", date: today(), amount: "", method: "CASH", notes: "" });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6" data-testid="advances-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Advances</h1>
          <p className="text-sm text-slate-500 mt-1">
            Buy side: money paid to growers against HOLD (recoverable). Sell side: money received from curing works against HOLD dispatches.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-advance" className="bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1.5" /> New Advance</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">New {side === "BUY" ? "Buy-side" : "Sell-side"} Advance</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{side === "BUY" ? "Grower (money paid to)" : "Curing Works (money received from)"}</Label>
                <SearchSelect options={parties.map((p) => ({ value: p.id, label: p.name, sub: p.village }))}
                  value={form.party_id} onChange={(v) => setForm({ ...form, party_id: v })} testId="advance-party-select" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" data-testid="advance-date-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Amount (₹)</Label><Input data-testid="advance-amount-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div>
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger data-testid="advance-method-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="BANK">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Input data-testid="advance-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button data-testid="advance-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white"
                disabled={!form.party_id || !(parseFloat(form.amount) > 0)} onClick={save}>Record Advance</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={side} onValueChange={setSide}>
        <TabsList className="bg-[#F2EBE0]">
          <TabsTrigger value="BUY" data-testid="advances-tab-buy">BUY · To Growers</TabsTrigger>
          <TabsTrigger value="SELL" data-testid="advances-tab-sell">SELL · From Curing Works</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-white border border-[#E5D9C8] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-semibold">No.</th>
              <th className="text-left px-4 py-2.5 font-semibold">Date</th>
              <th className="text-left px-4 py-2.5 font-semibold">Party</th>
              <th className="text-left px-4 py-2.5 font-semibold">Method</th>
              <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={d.id} className={`${i % 2 ? "bg-[#FDFBF7]" : ""} ${d.reversed ? "opacity-50" : ""}`} data-testid={`advance-row-${d.id}`}>
                <td className="px-4 py-2.5 font-mono font-semibold">{d.advance_no}{d.reversed && <Badge className="ml-2 bg-rose-100 text-rose-800 hover:bg-rose-100">REVERSED</Badge>}</td>
                <td className="px-4 py-2.5 font-mono text-slate-600">{d.date}</td>
                <td className="px-4 py-2.5">{d.party_name}</td>
                <td className="px-4 py-2.5 text-slate-600">{d.method}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold">{fmtINR(d.amount_paise)}</td>
                <td className="px-4 py-2.5 text-right">{!d.reversed && <ReverseButton refType="advance" refId={d.id} refNo={d.advance_no} onDone={load} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">No {side} advances yet.</div>}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { api, fmtINR, toPaise, today, errMsg } from "@/lib/api";
import { SearchSelect } from "@/components/SearchSelect";
import { ReverseButton } from "@/components/ReverseButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export default function Payments() {
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState({ party_id: "", date: today(), direction: "OUT", method: "CASH", amount: "", notes: "" });

  const load = useCallback(() => api.get("/payments").then((r) => setDocs(r.data)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (open) api.get("/parties").then((r) => setParties(r.data.filter((p) => p.active)));
  }, [open]);

  const save = async () => {
    try {
      const { data } = await api.post("/payments", {
        party_id: form.party_id, date: form.date, direction: form.direction,
        method: form.method, amount_paise: toPaise(form.amount), notes: form.notes,
      });
      toast.success(`Payment ${data.payment_no} recorded`);
      setOpen(false); setForm({ party_id: "", date: today(), direction: "OUT", method: "CASH", amount: "", notes: "" });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">Cash / bank, in or out, with any party.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-new-payment" className="bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1.5" /> New Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">New Payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Party</Label>
                <SearchSelect options={parties.map((p) => ({ value: p.id, label: p.name, sub: p.type }))}
                  value={form.party_id} onChange={(v) => setForm({ ...form, party_id: v })} testId="payment-party-select" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Direction</Label>
                  <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                    <SelectTrigger data-testid="payment-direction-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OUT">OUT — we pay</SelectItem>
                      <SelectItem value="IN">IN — we receive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" data-testid="payment-date-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>Amount (₹)</Label><Input data-testid="payment-amount-input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Input data-testid="payment-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button data-testid="payment-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white"
                disabled={!form.party_id || !(parseFloat(form.amount) > 0)} onClick={save}>Record Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-semibold">No.</th>
              <th className="text-left px-4 py-2.5 font-semibold">Date</th>
              <th className="text-left px-4 py-2.5 font-semibold">Party</th>
              <th className="text-left px-4 py-2.5 font-semibold">Direction</th>
              <th className="text-left px-4 py-2.5 font-semibold">Method</th>
              <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={d.id} className={`${i % 2 ? "bg-[#FDFBF7]" : ""} ${d.reversed ? "opacity-50" : ""}`} data-testid={`payment-row-${d.id}`}>
                <td className="px-4 py-2.5 font-mono font-semibold">{d.payment_no}{d.reversed && <Badge className="ml-2 bg-rose-100 text-rose-800 hover:bg-rose-100">REVERSED</Badge>}</td>
                <td className="px-4 py-2.5 font-mono text-slate-600">{d.date}</td>
                <td className="px-4 py-2.5">{d.party_name}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${d.direction === "IN" ? "text-emerald-700" : "text-rose-700"}`}>
                    {d.direction === "IN" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}{d.direction}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{d.method}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold">{fmtINR(d.amount_paise)}</td>
                <td className="px-4 py-2.5 text-right">{!d.reversed && <ReverseButton refType="payment" refId={d.id} refNo={d.payment_no} onDone={load} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">No payments yet.</div>}
      </div>
    </div>
  );
}

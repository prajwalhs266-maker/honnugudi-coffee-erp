import { useEffect, useState, useCallback } from "react";
import { api, fmtINR, fmtKG, fmtRate, toPaise, today, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Warehouse, PackageOpen, TrendingUp, HandCoins, ArrowDownToLine, ArrowUpFromLine, Scale, IndianRupee } from "lucide-react";

const KPI = ({ label, value, sub, icon: Icon, accent = "text-slate-900", testId }) => (
  <div className="bg-white border border-[#E5D9C8] rounded-lg p-5 hover:border-[#8B5A2B] transition-colors" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wider text-amber-900/70">{label}</span>
      <Icon className="h-4 w-4 text-[#8B5A2B]" />
    </div>
    <div className={`mt-2 font-mono font-bold text-2xl tracking-tight ${accent}`}>{value}</div>
    {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [stock, setStock] = useState([]);
  const [rateInput, setRateInput] = useState("");

  const load = useCallback(() => {
    api.get("/dashboard").then((r) => setD(r.data)).catch(() => {});
    api.get("/stock/summary").then((r) => setStock(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const setRate = async () => {
    try {
      await api.post("/market-rates", { date: today(), rate_paise: toPaise(rateInput) });
      toast.success("Market rate updated");
      setRateInput("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!d) return <div className="text-slate-500 py-20 text-center">Loading books...</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Today's Position</h1>
          <p className="text-sm text-slate-500 mt-1">Stock ledger and party ledger — derived live, never hand-edited.</p>
        </div>
        <div className="bg-[#2C1810] text-white rounded-lg px-5 py-3 flex items-center gap-4" data-testid="market-rate-widget">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#C9A87C]">Market Rate {d.market_rate_date ? `(${d.market_rate_date})` : ""}</div>
            <div className="font-mono font-bold text-xl" data-testid="market-rate-value">{fmtRate(d.market_rate_paise)}</div>
          </div>
          {user?.role === "admin" && (
            <div className="flex gap-2 items-center border-l border-[#5C3A21] pl-4">
              <Input value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="₹/kg"
                data-testid="market-rate-input" className="w-24 h-8 bg-[#3a271a] border-[#5C3A21] text-white placeholder:text-stone-300" />
              <Button size="sm" data-testid="market-rate-set-btn" className="h-8 bg-[#8B5A2B] hover:bg-[#a06a35] text-white" onClick={setRate}>Set</Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI testId="kpi-physical-stock" label="Physical Stock" value={fmtKG(d.physical_stock_g)} sub="All godowns" icon={Warehouse} accent="text-amber-900" />
        <KPI testId="kpi-buy-hold" label="Unpriced HOLD (Buy)" value={fmtKG(d.buy_hold_unpriced_g)}
          sub={d.buy_exposure_paise != null ? `≈ ${fmtINR(d.buy_exposure_paise)} at market rate` : "Set market rate to value"} icon={PackageOpen} accent="text-amber-900" />
        <KPI testId="kpi-sell-hold" label="Unpriced Dispatched (Sell)" value={fmtKG(d.sell_hold_unpriced_g)}
          sub={d.sell_exposure_paise != null ? `≈ ${fmtINR(d.sell_exposure_paise)} at market rate` : "Sell-side exposure"} icon={TrendingUp} accent="text-rose-700" />
        <KPI testId="kpi-cover-ratio" label="Stock Cover Ratio" value={d.stock_cover_ratio ?? "—"} sub="Physical ÷ unpriced buy HOLD" icon={Scale} />
        <KPI testId="kpi-buy-advances" label="Advances to Growers" value={fmtINR(d.buy_advances_outstanding_paise)} sub="Recoverable (buy side)" icon={HandCoins} />
        <KPI testId="kpi-sell-advances" label="Advances from Curing Works" value={fmtINR(d.sell_advances_outstanding_paise)} sub="Liability until settled (sell side)" icon={IndianRupee} />
        <KPI testId="kpi-receivables" label="Receivables" value={fmtINR(d.receivables_paise)} sub="Parties owe us" icon={ArrowDownToLine} accent="text-emerald-700" />
        <KPI testId="kpi-payables" label="Payables" value={fmtINR(d.payables_paise)} sub="We owe parties" icon={ArrowUpFromLine} accent="text-rose-700" />
      </div>

      <div className="bg-white border border-[#E5D9C8] rounded-lg" data-testid="stock-summary-card">
        <div className="px-5 py-4 border-b border-[#E5D9C8]">
          <h3 className="font-heading font-semibold text-slate-900">Stock by Product & Godown</h3>
        </div>
        {stock.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No stock yet. Enter a purchase bill to bring coffee in.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-2.5 font-semibold">Product</th>
                <th className="text-left px-3 py-2.5 font-semibold">Godown</th>
                <th className="text-right px-5 py-2.5 font-semibold">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((r, i) => (
                <tr key={i} className={i % 2 ? "bg-[#FDFBF7]" : "bg-white"} data-testid={`stock-row-${i}`}>
                  <td className="px-5 py-2.5">{r.product_name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.godown_name}</td>
                  <td className="px-5 py-2.5 text-right font-mono font-bold text-amber-900">{fmtKG(r.qty_g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { BillForm, BillList } from "@/pages/Purchases";

export default function Dispatches() {
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api.get("/dispatches").then((r) => setDocs(r.data)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-6" data-testid="dispatches-page">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Curing Dispatches</h1>
          <p className="text-sm text-slate-500 mt-1">The only physical stock outflow. SOLD = priced now, HOLD = priced later via sell-settlement.</p>
        </div>
        <BillForm kind="dispatch" partyType="curing_works" onSaved={load} />
      </div>
      <BillList kind="dispatch" docs={docs} onChanged={load} />
    </div>
  );
}

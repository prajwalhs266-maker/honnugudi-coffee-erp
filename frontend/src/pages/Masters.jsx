import { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const Section = ({ title, children, action }) => (
  <div className="bg-white border border-[#E5D9C8] rounded-lg">
    <div className="px-5 py-4 border-b border-[#E5D9C8] flex items-center justify-between">
      <h3 className="font-heading font-semibold text-slate-900">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const Table = ({ head, rows }) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-[#F5EFE6] text-[#4A3222] text-xs uppercase tracking-wider">
        {head.map((h, i) => <th key={i} className="text-left px-4 py-2.5 font-semibold">{h}</th>)}
      </tr>
    </thead>
    <tbody>{rows}</tbody>
  </table>
);

const ActiveBadge = ({ active }) => (
  <Badge className={active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-stone-200 text-stone-600 hover:bg-stone-200"}>
    {active ? "Active" : "Inactive"}
  </Badge>
);

const PartiesTab = ({ canWrite }) => {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "grower", phone: "", village: "" });
  const load = useCallback(() => api.get("/parties").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await api.post("/parties", { ...form, active: true });
      toast.success("Party added");
      setOpen(false); setForm({ name: "", type: "grower", phone: "", village: "" });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const toggle = async (p) => {
    try { await api.patch(`/parties/${p.id}`, { ...p, active: !p.active }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Section title="Parties" action={
      <div className="flex gap-2">
        <Input placeholder="Search parties..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="party-search-input" className="w-52 h-8 bg-white border-[#E5D9C8]" />
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="btn-add-party" className="h-8 bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1" />Party</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Party</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input data-testid="party-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger data-testid="party-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grower">Grower</SelectItem>
                      <SelectItem value="curing_works">Curing Works</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Phone</Label><Input data-testid="party-phone-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Village / Place</Label><Input data-testid="party-village-input" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} /></div>
                <Button data-testid="party-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white" onClick={save} disabled={!form.name.trim()}>Save Party</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    }>
      <Table head={["Name", "Type", "Phone", "Village", "Status", ""]} rows={filtered.map((p, i) => (
        <tr key={p.id} className={i % 2 ? "bg-[#FDFBF7]" : "bg-white"} data-testid={`party-row-${p.id}`}>
          <td className="px-4 py-2.5 font-medium">{p.name}</td>
          <td className="px-4 py-2.5"><Badge variant="outline" className="border-[#E5D9C8] text-slate-600">{p.type === "curing_works" ? "Curing Works" : p.type}</Badge></td>
          <td className="px-4 py-2.5 text-slate-600">{p.phone || "—"}</td>
          <td className="px-4 py-2.5 text-slate-600">{p.village || "—"}</td>
          <td className="px-4 py-2.5"><ActiveBadge active={p.active} /></td>
          <td className="px-4 py-2.5 text-right">
            {canWrite && <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`party-toggle-${p.id}`} onClick={() => toggle(p)}>{p.active ? "Deactivate" : "Activate"}</Button>}
          </td>
        </tr>
      ))} />
      {filtered.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No parties yet.</div>}
    </Section>
  );
};

const SimpleTab = ({ title, path, canWrite, testPrefix }) => {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const load = useCallback(() => api.get(`/${path}`).then((r) => setRows(r.data)), [path]);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { await api.post(`/${path}`, { name, active: true }); toast.success(`${title} added`); setOpen(false); setName(""); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const toggle = async (r) => {
    try { await api.patch(`/${path}/${r.id}`, { name: r.name, active: !r.active }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Section title={title} action={canWrite && (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" data-testid={`btn-add-${testPrefix}`} className="h-8 bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1" />Add</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New {title.slice(0, -1)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input data-testid={`${testPrefix}-name-input`} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button data-testid={`${testPrefix}-save-btn`} className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white" onClick={save} disabled={!name.trim()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    )}>
      <Table head={["Name", "Status", ""]} rows={rows.map((r, i) => (
        <tr key={r.id} className={i % 2 ? "bg-[#FDFBF7]" : "bg-white"}>
          <td className="px-4 py-2.5 font-medium">{r.name}</td>
          <td className="px-4 py-2.5"><ActiveBadge active={r.active} /></td>
          <td className="px-4 py-2.5 text-right">
            {canWrite && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggle(r)}>{r.active ? "Deactivate" : "Activate"}</Button>}
          </td>
        </tr>
      ))} />
      {rows.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">Nothing here yet.</div>}
    </Section>
  );
};

const SeasonsTab = ({ isAdmin }) => {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
  const load = useCallback(() => api.get("/seasons").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { await api.post("/seasons", { ...form, active: true }); toast.success("Season added"); setOpen(false); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Section title="Seasons" action={isAdmin && (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" data-testid="btn-add-season" className="h-8 bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1" />Season</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New Season</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name (e.g., 2025-26)</Label><Input data-testid="season-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Start date</Label><Input type="date" data-testid="season-start-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>End date</Label><Input type="date" data-testid="season-end-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            <Button data-testid="season-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white" onClick={save} disabled={!form.name || !form.start_date || !form.end_date}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    )}>
      <Table head={["Season", "Start", "End", "Status"]} rows={rows.map((r, i) => (
        <tr key={r.id} className={i % 2 ? "bg-[#FDFBF7]" : "bg-white"}>
          <td className="px-4 py-2.5 font-medium">{r.name}</td>
          <td className="px-4 py-2.5 text-slate-600">{r.start_date}</td>
          <td className="px-4 py-2.5 text-slate-600">{r.end_date}</td>
          <td className="px-4 py-2.5"><ActiveBadge active={r.active} /></td>
        </tr>
      ))} />
      {rows.length === 0 && <div className="px-5 py-8 text-sm text-slate-500">No seasons defined.</div>}
    </Section>
  );
};

const UsersTab = () => {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "operator" });
  const load = useCallback(() => api.get("/users").then((r) => setRows(r.data)), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    try { await api.post("/users", form); toast.success("User created"); setOpen(false); setForm({ name: "", email: "", password: "", role: "operator" }); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/users/${u.id}`, { active: !u.active }); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Section title="Users & Roles" action={
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" data-testid="btn-add-user" className="h-8 bg-[#2C1810] hover:bg-[#1E100B] text-white"><Plus className="h-4 w-4 mr-1" />User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input data-testid="user-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" data-testid="user-email-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="password" data-testid="user-password-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button data-testid="user-save-btn" className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white" onClick={save} disabled={!form.name || !form.email || !form.password}>Create User</Button>
          </div>
        </DialogContent>
      </Dialog>
    }>
      <Table head={["Name", "Email", "Role", "Status", ""]} rows={rows.map((u, i) => (
        <tr key={u.id} className={i % 2 ? "bg-[#FDFBF7]" : "bg-white"}>
          <td className="px-4 py-2.5 font-medium">{u.name}</td>
          <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
          <td className="px-4 py-2.5"><Badge variant="outline" className="border-[#E5D9C8] uppercase text-[10px]">{u.role}</Badge></td>
          <td className="px-4 py-2.5"><ActiveBadge active={u.active} /></td>
          <td className="px-4 py-2.5 text-right">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Activate"}</Button>
          </td>
        </tr>
      ))} />
    </Section>
  );
};

export default function Masters() {
  const { user } = useAuth();
  const canWrite = ["admin", "operator"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  return (
    <div className="space-y-6" data-testid="masters-page">
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Master Data</h1>
        <p className="text-sm text-slate-500 mt-1">Parties, products, godowns, seasons{isAdmin ? " and users" : ""}.</p>
      </div>
      <Tabs defaultValue="parties">
        <TabsList className="bg-[#F2EBE0]">
          <TabsTrigger value="parties" data-testid="tab-parties">Parties</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
          <TabsTrigger value="godowns" data-testid="tab-godowns">Godowns</TabsTrigger>
          <TabsTrigger value="seasons" data-testid="tab-seasons">Seasons</TabsTrigger>
          {isAdmin && <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>}
        </TabsList>
        <TabsContent value="parties" className="mt-4"><PartiesTab canWrite={canWrite} /></TabsContent>
        <TabsContent value="products" className="mt-4"><SimpleTab title="Products" path="products" canWrite={canWrite} testPrefix="product" /></TabsContent>
        <TabsContent value="godowns" className="mt-4"><SimpleTab title="Godowns" path="godowns" canWrite={canWrite} testPrefix="godown" /></TabsContent>
        <TabsContent value="seasons" className="mt-4"><SeasonsTab isAdmin={isAdmin} /></TabsContent>
        {isAdmin && <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

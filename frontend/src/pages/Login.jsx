import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coffee } from "lucide-react";
import { errMsg } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAF7F2]">
      <div className="hidden lg:flex flex-col justify-between bg-[#1C120C] p-12">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-md bg-[#8B5A2B] flex items-center justify-center">
            <Coffee className="h-6 w-6 text-[#FAF7F2]" />
          </div>
          <div>
            <div className="font-heading font-extrabold text-xl text-[#FAF7F2] tracking-tight">HONNUGUDI TRADERS</div>
            <div className="text-xs uppercase tracking-[0.25em] text-[#C9A87C]">Since 1985 · Coffee Trading</div>
          </div>
        </div>
        <div>
          <h1 className="font-heading text-4xl font-extrabold text-[#FAF7F2] leading-tight tracking-tight">
            Forty years of coffee,<br />one honest ledger.
          </h1>
          <p className="mt-4 text-stone-400 max-w-md text-sm leading-relaxed">
            Dual-ledger core. Symmetric HOLD / SOLD on both sides. Nothing deleted, everything reversible, every paisa accounted.
          </p>
        </div>
        <div className="text-xs text-stone-500">Stock in KG · Money in INR · On-premise, LAN-first</div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <Coffee className="h-6 w-6 text-[#8B5A2B]" />
            <span className="font-heading font-extrabold text-lg">HONNUGUDI ERP</span>
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to open the day's books.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" data-testid="login-email-input" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus className="bg-white border-[#E5D9C8]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" data-testid="login-password-input" value={password}
              onChange={(e) => setPassword(e.target.value)} required className="bg-white border-[#E5D9C8]" />
          </div>
          {error && <p className="text-sm text-rose-700" data-testid="login-error">{error}</p>}
          <Button type="submit" data-testid="login-submit-btn" disabled={busy}
            className="w-full bg-[#2C1810] hover:bg-[#1E100B] text-white">
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

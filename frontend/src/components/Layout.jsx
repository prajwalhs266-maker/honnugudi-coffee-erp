import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, HandCoins, Scale, Truck, Wallet, BookOpenText, Database, LogOut, Coffee,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "operator", "finance"] },
  { to: "/purchases", label: "Purchase Bills", icon: ShoppingCart, roles: ["admin", "operator"] },
  { to: "/advances", label: "Advances", icon: HandCoins, roles: ["admin", "operator"] },
  { to: "/settlements", label: "Settlements", icon: Scale, roles: ["admin", "operator"] },
  { to: "/dispatches", label: "Dispatches", icon: Truck, roles: ["admin", "operator"] },
  { to: "/payments", label: "Payments", icon: Wallet, roles: ["admin", "operator", "finance"] },
  { to: "/ledgers", label: "Ledgers", icon: BookOpenText, roles: ["admin", "operator", "finance"] },
  { to: "/masters", label: "Masters", icon: Database, roles: ["admin", "operator", "finance"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-[#FAF7F2]">
      <aside className="w-60 shrink-0 bg-[#1C120C] text-stone-200 flex flex-col" data-testid="sidebar">
        <div className="px-5 py-6 border-b border-[#3a271a]">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-[#8B5A2B] flex items-center justify-center">
              <Coffee className="h-5 w-5 text-[#FAF7F2]" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-[15px] tracking-tight text-[#FAF7F2]">HONNUGUDI</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#C9A87C]">Coffee Trading ERP</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive ? "bg-[#8B5A2B] text-white font-semibold" : "text-stone-300 hover:bg-[#2C1810] hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#3a271a]">
          <div className="text-sm font-medium text-[#FAF7F2]" data-testid="user-name">{user?.name}</div>
          <div className="text-xs text-[#C9A87C] uppercase tracking-wider mb-2" data-testid="user-role">{user?.role}</div>
          <Button
            variant="ghost"
            size="sm"
            data-testid="logout-btn"
            className="w-full justify-start text-stone-300 hover:text-white hover:bg-[#2C1810] px-2"
            onClick={async () => { await logout(); navigate("/login"); }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

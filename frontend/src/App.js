import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Masters from "@/pages/Masters";
import Purchases from "@/pages/Purchases";
import Dispatches from "@/pages/Dispatches";
import Advances from "@/pages/Advances";
import Settlements from "@/pages/Settlements";
import Payments from "@/pages/Payments";
import Ledgers from "@/pages/Ledgers";

const Protected = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2] text-slate-500">Opening the books...</div>;
  if (user === false) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/advances" element={<Advances />} />
            <Route path="/settlements" element={<Settlements />} />
            <Route path="/dispatches" element={<Dispatches />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/ledgers" element={<Ledgers />} />
            <Route path="/masters" element={<Masters />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;

import { useState } from "react";
import LandingPage from "./components/LandingPage";
import ApoDashboard from "./components/ApoDashboard";
import HalDashboard from "./components/HalDashboard";
import { ChevronLeft } from "lucide-react";

type View = "landing" | "dashboards";
type Tab = "hal" | "apo";

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [activeTab, setActiveTab] = useState<Tab>("hal");

  if (view === "landing") {
    return <LandingPage onEnter={() => setView("dashboards")} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="border-b border-zinc-800 bg-zinc-950 px-4 flex items-center gap-1">
        <button onClick={() => setView("landing")}
          className="flex items-center gap-1 px-3 py-3 text-xs text-zinc-600 hover:text-zinc-300 transition-colors mr-2">
          <ChevronLeft className="w-3 h-3" /> BACK
        </button>
        <div className="w-px h-5 bg-zinc-800 mr-2" />
        <button onClick={() => setActiveTab("hal")}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === "hal" ? "border-blue-500 text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
          HAL Dashboard — SCADA HMI
        </button>
        <button onClick={() => setActiveTab("apo")}
          className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 ${activeTab === "apo" ? "border-emerald-500 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
          APO Dashboard — Constraint Monitor
        </button>
        <div className="ml-auto text-[10px] text-zinc-600 uppercase tracking-widest px-3 py-1 border border-zinc-800 rounded">
          JS Layer — Demo Mode
        </div>
      </nav>
      {activeTab === "hal" ? <HalDashboard /> : <ApoDashboard />}
    </div>
  );
}

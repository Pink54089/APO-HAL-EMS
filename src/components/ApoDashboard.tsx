import { useState, useEffect, useRef, useCallback } from "react";
import {
  executeHalCycle,
  HalCycleResult,
  SAFE_NEUTRAL_POSITION,
  SafetyConfig,
  DEFAULT_SAFETY_CONFIG,
} from "../lib/apo";
import { Activity, ShieldAlert, Cpu, Zap, Play, Pause, ActivitySquare, CheckSquare2 } from "lucide-react";

const MAX_LOGS = 1000;

async function persistAuditEntry(result: HalCycleResult): Promise<void> {
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
  } catch { /* Non-fatal */ }
}

function ApoDashboard() {
  const [logs, setLogs] = useState<HalCycleResult[]>([]);
  const [lastResult, setLastResult] = useState<HalCycleResult | null>(null);
  const [isAuto, setIsAuto] = useState(false);
  const [sensors, setSensors] = useState<number[]>([60.0, 60.0, 60.0]);
  const [heartbeat, setHeartbeat] = useState(true);
  const [safetyConfig, setSafetyConfig] = useState<SafetyConfig>(DEFAULT_SAFETY_CONFIG);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(false);

  const updateSafetyNumber = useCallback(
    (key: keyof SafetyConfig) => (rawValue: string) => {
      const next = Number.parseFloat(rawValue);
      if (!Number.isFinite(next)) return;
      setSafetyConfig((prev) => ({ ...prev, [key]: next }));
    }, []
  );

  const runCycle = useCallback((newSensors: number[]) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    try {
      setSensors(newSensors);
      let result: HalCycleResult;
      try {
        result = executeHalCycle(newSensors, safetyConfig);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        result = {
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          sensors: newSensors, verifiedFreq: null, proposalsEval: [],
          finalAction: SAFE_NEUTRAL_POSITION, intercepted: true,
          message: `CYCLE FAULT INTERCEPTED: ${errMsg}`, executionTimeMs: 0,
        };
      }
      setLastResult(result);
      setLogs((prev) => {
        const updated = [...prev, result];
        return updated.length > MAX_LOGS ? updated.slice(-MAX_LOGS) : updated;
      });
      setHeartbeat((prev) => !prev);
      persistAuditEntry(result);
    } finally {
      isRunningRef.current = false;
    }
  }, [safetyConfig]);

  useEffect(() => {
    if (logs.length > 0) requestAnimationFrame(() => logsEndRef.current?.scrollIntoView({ behavior: "auto" }));
  }, [logs.length]);

  useEffect(() => {
    if (!isAuto) return;
    const interval = setInterval(() => {
      const rand = Math.random();
      let s1 = 60.0, s2 = 60.0, s3 = 60.0;
      if (rand < 0.05) { s1 = 60.0; s2 = 60.0; s3 = 59.5; }
      else if (rand < 0.15) { s1 = 59.9; s2 = 59.9; s3 = 59.9; }
      else {
        const base = 60.0 + (Math.random() - 0.5) * 0.05;
        s1 = base + (Math.random() - 0.5) * 0.005;
        s2 = base + (Math.random() - 0.5) * 0.005;
        s3 = base + (Math.random() - 0.5) * 0.005;
      }
      runCycle([Math.round(s1*1000)/1000, Math.round(s2*1000)/1000, Math.round(s3*1000)/1000]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isAuto, runCycle]);

  const variance = lastResult?.verifiedFreq === null ? "> 0.02" : "OK";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono p-4 md:p-8 selection:bg-emerald-900 selection:text-emerald-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-emerald-500" />
              APO-HAL EMS GOVERNOR <span className="text-zinc-600">v2.2.0</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Hardware Abstraction Layer | Zero-Stochasticity | NERC CIP-007</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded">
              <div className={`w-2 h-2 rounded-full ${heartbeat ? "bg-emerald-500" : "bg-zinc-600"}`} />
              <span>MODBUS WATCHDOG</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded">
              <div className={`w-2 h-2 rounded-full ${isAuto ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
              <span>SCADA LINK {isAuto ? "ACTIVE" : "STANDBY"}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <ActivitySquare className="w-4 h-4 text-blue-500" /> Redundant Sensor Array
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {sensors.map((s, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded p-2 text-center">
                    <div className="text-[10px] text-zinc-500 mb-1">S{i+1} (Hz)</div>
                    <div className={`text-sm font-bold ${s < 59.95 ? "text-amber-500" : s > 60.05 ? "text-red-400" : "text-emerald-400"}`}>{s.toFixed(3)}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center text-xs bg-zinc-950 border border-zinc-800 rounded p-2">
                <span className="text-zinc-500">CONSENSUS VARIANCE:</span>
                <span className={variance === "OK" ? "text-emerald-400" : "text-red-500 font-bold"}>{variance}</span>
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                  <Zap className="w-4 h-4 text-amber-500" /> Telemetry Injection
                </h2>
                <button onClick={() => setIsAuto(!isAuto)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${isAuto ? "bg-emerald-900/50 text-emerald-400 border border-emerald-800" : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"}`}>
                  {isAuto ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isAuto ? "AUTO: ON" : "AUTO: OFF"}
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Normal Cycle (60.0Hz)", sensors: [60.0,60.0,60.0], style: "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200", badge: "Step →" },
                  { label: "Freq Drop (59.9Hz)", sensors: [59.9,59.9,59.9], style: "bg-amber-950/30 hover:bg-amber-900/40 border-amber-900/50 text-amber-200", badge: "T1 ⚡" },
                  { label: "Data Injection", sensors: [60.0,60.0,59.5], style: "bg-red-950/30 hover:bg-red-900/40 border-red-900/50 text-red-200", badge: "Spoof ⚡" },
                ].map(({ label, sensors: s, style, badge }) => (
                  <button key={label} onClick={() => runCycle(s)} disabled={isAuto}
                    className={`w-full text-left px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed border rounded transition-colors text-sm flex justify-between items-center group ${style}`}>
                    <span>{label}</span><span className="opacity-50 group-hover:opacity-100">{badge}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-red-500" /> Safety Thresholds
              </h2>
              <div className="space-y-3 text-xs">
                {(["dataInjectionThreshold", "freqLowerBound", "heartbeatTimeoutMs"] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-zinc-500 uppercase tracking-wider">{key}</span>
                    <input type="number" value={safetyConfig[key]} onChange={(e) => updateSafetyNumber(key)(e.target.value)}
                      className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-300 w-full" />
                  </label>
                ))}
                <button onClick={() => setSafetyConfig(DEFAULT_SAFETY_CONFIG)}
                  className="w-full px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 transition-colors">
                  Reset to Defaults
                </button>
              </div>
            </section>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className={`p-4 border rounded-lg flex items-start gap-3 ${lastResult?.intercepted ? "bg-red-950/20 border-red-900/50 text-red-400" : "bg-emerald-950/20 border-emerald-900/50 text-emerald-400"}`}>
              {lastResult?.intercepted ? <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" /> : <Activity className="w-5 h-5 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <div className="text-sm leading-relaxed font-bold">{lastResult?.message || "SYSTEM INITIALIZED. WAITING FOR TELEMETRY."}</div>
                {lastResult && (
                  <div className="text-xs mt-2 opacity-70 flex gap-4">
                    <span>LATENCY: {lastResult.executionTimeMs.toFixed(2)}ms / {safetyConfig.heartbeatTimeoutMs}ms</span>
                    <span>ACTION: {lastResult.finalAction}</span>
                  </div>
                )}
              </div>
            </div>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-zinc-100 mb-4 uppercase tracking-wider flex items-center gap-2">
                <CheckSquare2 className="w-4 h-4 text-purple-500" /> Tiered Constraint SCI & GDPO Selection
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="pb-2 font-normal">NEURAL PROPOSAL</th>
                      <th className="pb-2 font-normal text-right">SURVIVAL</th>
                      <th className="pb-2 font-normal text-right">ECONOMIC</th>
                      <th className="pb-2 font-normal text-center">STATUS</th>
                      <th className="pb-2 font-normal text-right">GDPO UTILITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {lastResult?.proposalsEval.map((evalObj, i) => {
                      const isSelected = lastResult.finalAction === evalObj.proposal.action;
                      return (
                        <tr key={i} className={isSelected ? "bg-emerald-950/20" : ""}>
                          <td className={`py-3 ${evalObj.passed ? "text-zinc-300" : "text-zinc-600 line-through"}`}>{evalObj.proposal.action}</td>
                          <td className="py-3 text-right text-zinc-400">{evalObj.proposal.survivalScore.toFixed(1)}</td>
                          <td className="py-3 text-right text-zinc-400">{evalObj.proposal.economicScore.toFixed(1)}</td>
                          <td className="py-3 text-center">
                            {evalObj.passed
                              ? <span className="px-2 py-1 bg-emerald-950/50 text-emerald-400 rounded text-[10px]">PASS</span>
                              : <span className="px-2 py-1 bg-red-950/50 text-red-400 rounded text-[10px]" title={evalObj.reason}>CRUSHED</span>}
                          </td>
                          <td className="py-3 text-right font-mono">
                            {evalObj.passed
                              ? <span className={isSelected ? "text-emerald-400 font-bold" : "text-zinc-400"}>{evalObj.utility.toFixed(4)}</span>
                              : <span className="text-red-500">-∞</span>}
                          </td>
                        </tr>
                      );
                    }) || <tr><td colSpan={5} className="py-4 text-center text-zinc-600 italic">Awaiting first cycle...</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col h-48">
              <div className="p-4 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">Persistence Layer (apo_audit.csv) — NERC CIP-007</h2>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {logs.length === 0 ? (
                  <div className="text-zinc-600 text-sm italic text-center mt-4">No actions logged yet.</div>
                ) : logs.map((log, i) => (
                  <div key={i} className="text-xs grid grid-cols-12 gap-4 py-1 border-b border-zinc-800/50 last:border-0">
                    <div className="col-span-3 text-zinc-500">{log.timestamp.split(" ")[1]}</div>
                    <div className={`col-span-3 ${log.intercepted ? "text-red-400" : "text-emerald-400"}`}>{log.intercepted ? "INTERCEPTED" : "DISPATCHED"}</div>
                    <div className={`col-span-6 ${log.finalAction === SAFE_NEUTRAL_POSITION ? "text-amber-400" : "text-zinc-300"}`}>{log.finalAction}</div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApoDashboard;

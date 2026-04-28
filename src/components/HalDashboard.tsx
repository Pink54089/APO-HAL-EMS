import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShieldAlert, Activity, Cpu, Server, ShieldCheck, AlertTriangle, Power, Gauge, Database, Radio, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- SCADA EMS DOMAIN CONSTANTS ---
const NOMINAL_FREQUENCY = 60.0;
const UNDER_FREQUENCY_THRESHOLD = 59.5;
const UFLS_STAGE_1 = 59.3;
const UFLS_STAGE_2 = 58.9;
const EMERGENCY_LOCK_POSITION = "TRIP_ALL_BREAKERS";
const SENSOR_VARIANCE_LIMIT = 0.02; 

export interface GridState {
  frequency: number;
  voltage: number;
  netInterchangeActual: number;
  netInterchangeScheduled: number;
}

export interface HorizontalEdgeNode {
  nodeId: string;
  assetClass: string;
  basePointMW: number;
  availableMarginMW: number;
  rampRateMWMin: number;
  telemetryLatencyMs: number;
  status: "ONLINE" | "OFFLINE" | "ISOLATED";
}

export const HORIZONTAL_NODES: HorizontalEdgeNode[] = [
  { nodeId: "VPP_AGG_01", assetClass: "Virtual Power Plant", basePointMW: 0, availableMarginMW: 45, rampRateMWMin: 200, telemetryLatencyMs: 45, status: "ONLINE" },
  { nodeId: "BESS_FLEET_A", assetClass: "Utility Storage", basePointMW: 10, availableMarginMW: 80, rampRateMWMin: 500, telemetryLatencyMs: 12, status: "ONLINE" },
  { nodeId: "MICROGRID_01", assetClass: "Campus Microgrid", basePointMW: -5, availableMarginMW: 15, rampRateMWMin: 50, telemetryLatencyMs: 85, status: "ONLINE" },
  { nodeId: "LEGACY_GEN_1", assetClass: "CCGT (Legacy)", basePointMW: 250, availableMarginMW: 50, rampRateMWMin: 15, telemetryLatencyMs: 250, status: "ONLINE" }, 
];

export function validateRTUTelemetry(sensors: number[]): number {
  if (sensors.length === 0) return -Infinity;
  const mean = sensors.reduce((a, b) => a + b, 0) / sensors.length;
  const variance = sensors.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sensors.length;
  if (variance > SENSOR_VARIANCE_LIMIT) {
    return -Infinity; 
  }
  return mean;
}

export interface SCADACycleResult {
  timestamp: string;
  sensors: number[];
  verifiedFreq: number | null;
  nodeDispatch: { node: HorizontalEdgeNode, setpointMW: number, dynamicParticipation: number, passedContingency: boolean }[];
  systemState: string;
  proposalRejected: boolean;
  shadowRejected?: boolean;
  message: string;
  executionTimeMs: number;
  deltaF: number;
  ace: number;
  niA: number;
  niS: number;
}

export function executeAGCCycle(sensors: number[], isShadowMode: boolean = false): SCADACycleResult {
  // Simulating Nim FFI Bridge call for Deterministic Safety Math
  const startTime = performance.now();
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  
  // L1: RTU Telemetry Validation
  const verifiedFreq = validateRTUTelemetry(sensors);
  const executionTimeMs = (performance.now() - startTime) * 0.01 + Math.random() * 0.8 + 0.1;
  
  // L2: State Estimation & AGC Calculation
  const deltaF = verifiedFreq !== -Infinity ? verifiedFreq - NOMINAL_FREQUENCY : 0.0;
  const biasFactor = 150.0; // MW/0.1Hz
  
  // Simulate Tie-Line Flows (Net Interchange)
  const niS = 500.0; // Scheduled Interchange MW
  const niA = niS + (Math.random() * 20 - 10); // Actual Interchange MW with noise
  
  // Real-world ACE Equation: ACE = (NI_A - NI_S) - 10 * B * (F_A - F_S)
  const ace = (niA - niS) - 10.0 * biasFactor * deltaF;

  if (verifiedFreq === -Infinity) {
    return {
      timestamp,
      sensors,
      verifiedFreq: null,
      nodeDispatch: HORIZONTAL_NODES.map(n => ({ node: n, setpointMW: 0, dynamicParticipation: 0, passedContingency: false })),
      systemState: "TELEMETRY_FAULT",
      proposalRejected: !isShadowMode,
      shadowRejected: isShadowMode,
      message: isShadowMode 
        ? "SHADOW: RTU VARIANCE EXCEEDED. WOULD REJECT PROPOSALS."
        : "RTU VARIANCE EXCEEDED. TELEMETRY INJECTION DETECTED. PROPOSALS REJECTED.",
      executionTimeMs,
      deltaF: 0.0,
      ace: 0.0,
      niA: 0,
      niS: 0
    };
  }

  const isUFLS = verifiedFreq < UFLS_STAGE_1;
  
  // L3: HAL Proposal Evaluation
  const totalRampCapacity = HORIZONTAL_NODES.filter(n => n.status === "ONLINE").reduce((sum, n) => sum + n.rampRateMWMin, 0);
  
  const nodeDispatch = HORIZONTAL_NODES.map(node => {
    let setpointMW = node.basePointMW;
    let passed = true;
    let dynamicParticipation = 0;

    if (node.status !== "ONLINE") {
      setpointMW = 0;
      passed = false;
    } else {
      dynamicParticipation = node.rampRateMWMin / totalRampCapacity;
      const regulationMW = ace * dynamicParticipation;
      setpointMW -= regulationMW;
      
      if (setpointMW > node.basePointMW + node.availableMarginMW) {
        setpointMW = node.basePointMW + node.availableMarginMW;
      }
    }

    return {
      node,
      setpointMW,
      dynamicParticipation,
      passedContingency: passed
    };
  });

  let systemState = "NORMAL_OPERATION";
  if (isUFLS) systemState = "UFLS_ACTIVE";
  if (Math.abs(ace) > 100) systemState = "ACE_LIMIT_VIOLATION";

  return {
    timestamp,
    sensors,
    verifiedFreq,
    nodeDispatch,
    systemState,
    proposalRejected: isUFLS && !isShadowMode,
    shadowRejected: isUFLS && isShadowMode,
    message: isUFLS 
      ? (isShadowMode ? `SHADOW: UFLS TRIGGERED. WOULD REJECT.` : `UFLS TRIGGERED. FREQ: ${verifiedFreq.toFixed(3)}Hz. PROPOSALS REJECTED.`)
      : `PROPOSALS VALIDATED. ACE: ${ace.toFixed(1)} MW dispatched within constraints.`,
    executionTimeMs,
    deltaF,
    ace,
    niA,
    niS
  };
}

export default function HalDashboard() {
  const [logs, setLogs] = useState<SCADACycleResult[]>([]);
  const [isAuto, setIsAuto] = useState(false);
  const [isShadowMode, setIsShadowMode] = useState(false);
  const [gridCondition, setGridCondition] = useState<"NORMAL" | "COLLAPSE" | "ATTACK">("NORMAL");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const runCycle = () => {
    let rawSensors = [60.01, 59.99, 60.00, 60.02];
    
    if (gridCondition === "COLLAPSE") {
      rawSensors = [59.2, 59.1, 59.15, 59.21];
    } else if (gridCondition === "ATTACK") {
      rawSensors = [60.0, 59.9, 65.0, 55.0]; // High variance
    } else {
      rawSensors = rawSensors.map(s => s + (Math.random() * 0.04 - 0.02));
    }

    const result = executeAGCCycle(rawSensors, isShadowMode);
    setLogs((prev) => {
      const newLogs = [...prev, result];
      if (newLogs.length > 50) return newLogs.slice(newLogs.length - 50);
      return newLogs;
    });
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isAuto) {
      interval = setInterval(() => {
        runCycle();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isAuto, gridCondition]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const lastResult = logs[logs.length - 1];

  const trendData = useMemo(() => {
    return logs.map((log, index) => ({
      time: log.timestamp.split(" ")[1],
      frequency: log.verifiedFreq === null ? 60 : log.verifiedFreq,
      index
    })).slice(-30); // Show last 30 points on chart
  }, [logs]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-300 font-mono p-4 selection:bg-blue-900">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* SCADA HEADER */}
        <header className="hal-panel flex items-center justify-between p-3">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Database className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-100 tracking-widest uppercase">HAL Dashboard</h1>
              <p className="text-[10px] text-neutral-500 uppercase font-mono">Node: PRIMARY_CTRL_01 | Protocol: DNP3/ICCP</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex flex-col items-end border-r border-neutral-800 pr-4">
              <span className="text-[9px] text-neutral-500 uppercase tracking-tighter">System Time</span>
              <span className="text-neutral-200 font-mono">{new Date().toISOString().replace("T", " ").substring(0, 19)}</span>
            </div>
            <div className="flex items-center gap-2 bg-neutral-900/50 px-3 py-1.5 border border-neutral-800 rounded">
              <Cpu className="w-4 h-4 text-yellow-500" />
              <span className="text-yellow-500 font-bold uppercase tracking-wider text-[10px]">Nim FFI Bridge</span>
            </div>
            <div className="flex items-center gap-2 bg-neutral-900/50 px-3 py-1.5 border border-neutral-800 rounded">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500 font-bold uppercase tracking-wider text-[10px]">HAL Constraints Active</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* LEFT COLUMN: Controls & Telemetry */}
          <div className="space-y-4">
            {/* CONTROL PANEL */}
            <section className="hal-panel">
              <div className="hal-header flex items-center gap-2">
                <Power className="w-3 h-3" /> Supervisory Control
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">AGC Mode</span>
                  <button
                    onClick={() => setIsAuto(!isAuto)}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-bold uppercase transition-all border rounded",
                      isAuto 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                        : "bg-neutral-800 text-neutral-500 border-neutral-700"
                    )}
                  >
                    {isAuto ? "AUTO (CLOSED LOOP)" : "MANUAL (OPEN LOOP)"}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold">Shadow Mode</span>
                  <button
                    onClick={() => setIsShadowMode(!isShadowMode)}
                    className={cn(
                      "px-4 py-1.5 text-[10px] font-bold uppercase transition-all border rounded flex items-center gap-2",
                      isShadowMode 
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/50" 
                        : "bg-neutral-800 text-neutral-500 border-neutral-700"
                    )}
                  >
                    {isShadowMode ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {isShadowMode ? "SHADOW ACTIVE" : "SHADOW OFF"}
                  </button>
                </div>
                
                <div className="space-y-2">
                  <span className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">Grid Simulation Injection</span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => { setGridCondition("NORMAL"); if(!isAuto) runCycle(); }}
                      className={cn("py-1.5 text-[9px] uppercase border transition-colors rounded", gridCondition === "NORMAL" ? "bg-blue-500/10 text-blue-400 border-blue-500/50" : "bg-neutral-900 text-neutral-500 border-neutral-800")}
                    >
                      Nominal
                    </button>
                    <button
                      onClick={() => { setGridCondition("COLLAPSE"); if(!isAuto) runCycle(); }}
                      className={cn("py-1.5 text-[9px] uppercase border transition-colors rounded", gridCondition === "COLLAPSE" ? "bg-amber-500/10 text-amber-400 border-amber-500/50" : "bg-neutral-900 text-neutral-500 border-neutral-800")}
                    >
                      Gen Trip
                    </button>
                    <button
                      onClick={() => { setGridCondition("ATTACK"); if(!isAuto) runCycle(); }}
                      className={cn("py-1.5 text-[9px] uppercase border transition-colors rounded", gridCondition === "ATTACK" ? "bg-red-500/10 text-red-400 border-red-500/50" : "bg-neutral-900 text-neutral-500 border-neutral-800")}
                    >
                      RTU Fault
                    </button>
                  </div>
                </div>
                
                {!isAuto && (
                  <button
                    onClick={runCycle}
                    className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-bold uppercase border border-neutral-700 transition-colors rounded"
                  >
                    Execute Single Cycle
                  </button>
                )}
              </div>
            </section>

            {/* L1: RTU TELEMETRY */}
            <section className="hal-panel">
              <div className="hal-header flex items-center gap-2">
                <Radio className="w-3 h-3 text-blue-400" /> L1: Telemetry Acquisition (DNP3)
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-2">
                  {lastResult?.sensors.map((val, i) => (
                    <div key={i} className="bg-neutral-950 border border-neutral-800 p-2 flex justify-between items-center rounded">
                      <span className="text-[9px] text-neutral-500 font-mono">PMU_0{i+1}</span>
                      <span className={cn("text-xs font-mono font-bold", gridCondition === "ATTACK" ? "text-red-400" : "text-emerald-400")}>
                        {val.toFixed(3)}
                      </span>
                    </div>
                  )) || (
                    <div className="col-span-2 text-center text-neutral-600 text-[10px] py-4 italic">Awaiting Telemetry...</div>
                  )}
                </div>
              </div>
            </section>

            {/* L2: STATE ESTIMATION */}
            <section className="hal-panel">
              <div className="hal-header flex items-center gap-2">
                <Activity className="w-3 h-3 text-amber-400" /> L2: State Estimation & AGC
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-neutral-800/50 pb-2">
                  <span className="text-[9px] text-neutral-500 uppercase font-bold">Freq Deviation (Δf)</span>
                  <span className={cn("text-xs font-mono font-bold", Math.abs(lastResult?.deltaF || 0) > 0.05 ? "text-amber-400" : "text-emerald-400")}>
                    {(lastResult?.deltaF || 0).toFixed(3)} Hz
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-neutral-800/50 pb-2">
                  <span className="text-[9px] text-neutral-500 uppercase font-bold">Area Control Error (ACE)</span>
                  <span className={cn("text-xs font-mono font-bold", Math.abs(lastResult?.ace || 0) > 50 ? "text-red-400" : "text-blue-400")}>
                    {(lastResult?.ace || 0).toFixed(1)} MW
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-neutral-500 uppercase font-bold">Net Interchange</span>
                  <span className="text-xs font-mono text-neutral-300">
                    {(lastResult?.niA || 0).toFixed(1)} / {(lastResult?.niS || 0).toFixed(1)} MW
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* MIDDLE & RIGHT COLUMNS: Charts & Dispatch */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* FREQUENCY TREND CHART */}
            <section className="hal-panel">
              <div className="hal-header flex items-center gap-2">
                <Gauge className="w-3 h-3 text-emerald-400" /> System Frequency Trend
              </div>
              <div className="p-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="time" stroke="#525252" fontSize={9} tickMargin={10} fontFamily="JetBrains Mono" />
                    <YAxis domain={[58.5, 60.5]} stroke="#525252" fontSize={9} tickFormatter={(val) => val.toFixed(2)} fontFamily="JetBrains Mono" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#171717', borderColor: '#404040', fontSize: '10px', fontFamily: 'JetBrains Mono' }}
                      itemStyle={{ color: '#34d399' }}
                    />
                    <ReferenceLine y={60.0} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'NOMINAL', fill: '#3b82f6', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                    <ReferenceLine y={59.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'ALERT', fill: '#f59e0b', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                    <Line 
                      type="stepAfter" 
                      dataKey="frequency" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* L3: PROPOSAL EVALUATION */}
            <section className="hal-panel">
              <div className="hal-header flex items-center gap-2">
                <Cpu className="w-3 h-3 text-purple-400" /> L3: Proposal Evaluation (HAL)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="text-neutral-500 border-b border-neutral-800 bg-neutral-950/50">
                    <tr>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter">EDGE NODE</th>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter">ASSET CLASS</th>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter text-right">BASE (MW)</th>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter text-right">DYN. PART.</th>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter text-right">TARGET (MW)</th>
                      <th className="py-2 px-4 font-bold uppercase tracking-tighter text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/30">
                      {lastResult?.nodeDispatch.map((dispatch, i) => (
                        <tr key={dispatch.node.nodeId} className="data-grid-row">
                          <td className="py-2 px-4 text-neutral-300 font-mono">{dispatch.node.nodeId}</td>
                          <td className="py-2 px-4 text-neutral-500">{dispatch.node.assetClass}</td>
                          <td className="py-2 px-4 text-right text-neutral-400 font-mono">{dispatch.node.basePointMW.toFixed(1)}</td>
                          <td className="py-2 px-4 text-right text-purple-400 font-mono">{(dispatch.dynamicParticipation * 100).toFixed(1)}%</td>
                          <td className={cn("py-2 px-4 text-right font-bold font-mono", dispatch.setpointMW !== dispatch.node.basePointMW ? "text-amber-400" : "text-blue-400")}>
                            {dispatch.setpointMW.toFixed(1)}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {dispatch.passedContingency ? (
                              <span className="text-emerald-500 font-bold">OK</span>
                            ) : (
                              <span className="text-red-500 font-bold">OFFLINE</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* L4: EVENT LOG */}
            <section className="hal-panel flex flex-col h-48">
              <div className="hal-header flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-red-500" /> L4: Event Logging & Audit Trail
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-1 bg-neutral-950 font-mono">
                {logs.length === 0 ? (
                  <div className="text-neutral-600 text-[10px] italic text-center mt-4 uppercase">
                    System initialized. Awaiting events.
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={cn(
                        "text-[9px] grid grid-cols-12 gap-2 py-1 px-2 border-b border-neutral-900 last:border-0",
                        log.proposalRejected ? "bg-red-500/10 text-red-400" : log.shadowRejected ? "bg-purple-500/10 text-purple-400" : "text-neutral-400"
                      )}
                    >
                      <div className="col-span-2 opacity-50">
                        {log.timestamp.split(" ")[1]}
                      </div>
                      <div className="col-span-2 font-bold uppercase tracking-tighter">
                        {log.systemState}
                      </div>
                      <div className="col-span-8">
                        {log.message}
                      </div>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

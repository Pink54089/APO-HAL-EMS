import { useState, useEffect } from "react";
import { Shield, Zap, Cpu, ChevronRight, Lock, Radio, GitBranch } from "lucide-react";

interface LandingPageProps {
  onEnter: () => void;
}

const BOOT_LINES = [
  "INITIALIZING APO-HAL-EMS GOVERNOR v2.2.0...",
  "LOADING DETERMINISTIC POLICY ENGINE...",
  "SENSOR VALIDATION MODULE: ACTIVE",
  "PHYSICAL CROSS-CHECK LAYER: ARMED",
  "CONSTRAINT EVALUATION ENGINE: ENGAGED",
  "MODBUS WATCHDOG: 60Hz CYCLE LOCKED",
  "POLICY INTERFACE: READY",
  "DETERMINISTIC MODE: VERIFIED",
  "ALL SYSTEMS NOMINAL. AWAITING OPERATOR.",
];

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootDone, setBootDone] = useState(false);
  const [tick, setTick] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setBootDone(true), 400);
      }
    }, 180);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((p) => !p), 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-mono flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest">
        <span>APO-HAL-EMS // DETERMINISTIC GRID GOVERNOR</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${tick ? "bg-emerald-500" : "bg-emerald-800"}`} />
            LIVE DEMO
          </span>
          <span>ISO/RTO SCADA</span>
          <span>NERC CIP-007</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="w-full mb-16">
          <div className="text-[10px] text-emerald-500 uppercase tracking-[0.3em] mb-4">Agnostic-Policy Optimizer</div>
          <h1 className="text-5xl md:text-7xl font-black text-zinc-100 leading-none mb-2 tracking-tight">
            APO<span className="text-emerald-500">-</span>HAL<span className="text-zinc-600">-</span>EMS
          </h1>
          <div className="text-zinc-500 text-sm uppercase tracking-widest mt-4 mb-8">
            Hardware Abstraction Layer // Universal Critical Infrastructure Governance
          </div>
          <p className="text-zinc-400 text-base leading-relaxed max-w-2xl">
            A universal governance layer for critical infrastructure control systems.
            Intercepts and validates all control commands — from AI, automation, or human
            operators — against hard physics constraints before execution. Primary focus on
            Energy Management Systems. Adaptable to water, transportation, manufacturing, and
            other safety-critical domains.
          </p>
        </div>

        <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 mb-10">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Radio className="w-3 h-3" /> SYSTEM BOOT TRACE
          </div>
          <div className="space-y-1">
            {bootLines.map((line, i) => (
              <div key={i} className="text-xs flex items-center gap-2">
                <span className="text-emerald-600">[OK]</span>
                <span className={i === bootLines.length - 1 && !bootDone ? "text-zinc-300" : "text-zinc-500"}>{line}</span>
              </div>
            ))}
            {!bootDone && (
              <div className="text-xs flex items-center gap-2">
                <span className="text-emerald-600">[  ]</span>
                <span className={`inline-block w-2 h-3 bg-zinc-300 ${tick ? "opacity-100" : "opacity-0"}`} />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
          {[
            { icon: <Shield className="w-5 h-5 text-emerald-500" />, title: "Multi-Layer Validation", desc: "Telemetry bounds checking, physical sensor validation, and tiered constraint evaluation. Byzantine-resistant architecture defeats coordinated sensor attacks." },
            { icon: <Cpu className="w-5 h-5 text-blue-400" />, title: "Deterministic Safety Kernel", desc: "Proprietary execution engine with hardware-verified determinism. Sub-millisecond decision validation within grid cycle constraints." },
            { icon: <Zap className="w-5 h-5 text-amber-400" />, title: "Policy-Agnostic Interface", desc: "Universal decision layer works with any control source — AI optimizers, classical automation, or human operators. Zero stochasticity in safety path." },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5">
              <div className="mb-3">{icon}</div>
              <div className="text-sm font-bold text-zinc-100 mb-2">{title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-10 justify-center">
          {["NERC CIP-007", "IEEE 1547-2018", "ISO/RTO SCADA", "Modbus/TCP", "N-1 Reliability"].map((badge) => (
            <span key={badge} className="px-3 py-1 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-400 uppercase tracking-wider">{badge}</span>
          ))}
        </div>

        <div className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-4 mb-10 flex items-start gap-3">
          <Lock className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
          <p className="text-xs text-zinc-600 leading-relaxed">
            The proprietary safety kernel powering this system uses advanced deterministic methods
            not included in this public demonstration. The interactive dashboards showcase the
            architecture and interface using simplified reference algorithms. Production deployment
            requires commercial licensing.
          </p>
        </div>

        {bootDone && (
          <div className="flex flex-col sm:flex-row gap-4 w-full items-center justify-center">
            <button onClick={onEnter}
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-sm uppercase tracking-widest rounded transition-colors">
              LAUNCH INTERACTIVE DEMO <ChevronRight className="w-4 h-4" />
            </button>
            <a href="https://github.com/Pink54089/APO-HAL-EMS" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-sm uppercase tracking-widest rounded transition-colors">
              <GitBranch className="w-4 h-4" /> VIEW REPOSITORY
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 px-6 py-3 flex items-center justify-between text-[10px] text-zinc-700 uppercase tracking-widest">
        <span>APO-HAL-EMS // MIT LICENSE</span>
        <span>DETERMINISTIC GRID GOVERNANCE // KL = 0.0</span>
      </div>
    </div>
  );
}

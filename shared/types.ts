// =============================================================================
// APO-EMS: Shared Type Definitions
// Single source of truth for all TypeScript and Nim FFI bridge types.
// =============================================================================

export interface GridState {
  frequency: number;              // Hz — must be 55.0–65.0
  voltage: number;                // per-unit (PU)
  netInterchangeActual: number;   // MW — actual tie-line flow
  netInterchangeScheduled: number;// MW — scheduled tie-line flow
  activePowerKWac: number;        // kW AC
  reactivePowerKVAR: number;      // kVAR
  apparentPowerKVA: number;       // kVA
  economicYield: number;          // Economic optimization score
}

export interface PathProposal {
  id: number;
  agentId: string;                // Source agent identifier
  action: string;                 // Command string
  survivalScore: number;          // Must be >= 1.0 to pass Tier 1
  economicScore: number;          // Must be >= 0.0 to pass Tier 2
  microEfficiency: number;        // For GDPO contrastive selection
  magnitude: number;              // MW magnitude of action
}

export interface ProposalEval {
  proposalId: number;
  passed: boolean;
  reason: string;
  utility: number;                // GDPO score, -Infinity if rejected
}

export interface HalCycleResult {
  timestamp: string;
  intercepted: boolean;
  finalAction: string;
  message: string;
  klDivergence: number;
  executionTimeMs: number;
  evaluations: ProposalEval[];
  // Dashboard-layer additions (not from Nim)
  sensors?: number[];
  ndirReading?: number;
  verifiedFreq?: number | null;
  gridStateSnapshot?: GridState;
}

export interface AuditLogEntry extends HalCycleResult {
  cycleId: string;                // UUID for NERC CIP-007 forensic trail
  hash: string;                   // SHA-256 of cycle data
  operatorId?: string;            // For shadow mode engineer attribution
}

// =============================================================================
// CANONICAL CONSTANTS
// =============================================================================

export const SAFE_NEUTRAL_POSITION  = "SAFE_LOCK_ACTUATORS";
export const SYSTEM_IDLE            = "SYSTEM_STANDBY_NO_ACTUATION";
export const DATA_INJECTION_THRESHOLD = 0.02;
export const NDIR_MISMATCH_THRESHOLD  = 0.01;
export const CRITICAL_BLACKOUT_THRESHOLD = 58.5;  // Hz
export const HEARTBEAT_TIMEOUT_MS   = 16.6;        // 60Hz grid cycle window
export const UFLS_STAGE_1           = 59.3;        // Hz
export const VOLTAGE_UPPER_LIMIT_PU = 1.05;
export const VOLTAGE_LOWER_LIMIT_PU = 0.95;

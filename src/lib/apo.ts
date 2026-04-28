// APO-HAL-EMS: Simplified Demo Layer
// This is a demonstration implementation showing the architecture concept.
// The proprietary safety kernel implements the full deterministic algorithms.

import {
  isNimRuntimeAvailable,
  executeHalCycleNim,
  NIM_CONSTANTS,
  safeNeutralFallback,
} from './nim-wrapper';
import type { HalCycleResult } from '../../shared/types';

// Re-export constants
export const SAFE_NEUTRAL_POSITION = NIM_CONSTANTS.SAFE_NEUTRAL_POSITION;
export const SYSTEM_IDLE = NIM_CONSTANTS.SYSTEM_IDLE;

// Simplified safety configuration for demo
export interface SafetyConfig {
  dataInjectionThreshold: number;
  freqLowerBound: number;
  heartbeatTimeoutMs: number;
}

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  dataInjectionThreshold: 0.02,
  freqLowerBound: 59.95,
  heartbeatTimeoutMs: 16.6,
};

// Demo proposals
interface Proposal {
  action: string;
  survivalScore: number;
  economicScore: number;
}

const DEMO_PROPOSALS: Proposal[] = [
  { action: "MAINTAIN_CURRENT_LOAD", survivalScore: 1.0, economicScore: 10.0 },
  { action: "INCREASE_GEN_BUS_1", survivalScore: 1.0, economicScore: 50.0 },
  { action: "SHED_NON_CRITICAL_BUS_7", survivalScore: 1.0, economicScore: -20.0 },
  { action: "MAX_PROFIT_OVERDRIVE", survivalScore: 0.5, economicScore: 100.0 },
];

// Simplified HAL cycle execution for demo purposes
export function executeHalCycle(
  sensors: number[],
  config: SafetyConfig
): HalCycleResult {
  const startTime = performance.now();

  // If Nim kernel is available, use it (production path)
  if (isNimRuntimeAvailable()) {
    return executeHalCycleNim(sensors);
  }

  // Demo fallback: simplified 3-layer validation concept
  try {
    // Layer 1: Telemetry bounds check
    const avgFreq = sensors.reduce((a, b) => a + b, 0) / sensors.length;
    if (avgFreq < config.freqLowerBound) {
      return createResult(startTime, sensors, null, true, 
        "L1 VIOLATION: Grid frequency below survival threshold");
    }

    // Layer 2: Sensor consensus check (simplified)
    const variance = Math.max(...sensors) - Math.min(...sensors);
    if (variance > config.dataInjectionThreshold) {
      return createResult(startTime, sensors, null, true,
        "L2 VIOLATION: Sensor consensus failed — possible Byzantine attack");
    }

    // Layer 3: Proposal evaluation (simplified demo logic)
    const evaluations = DEMO_PROPOSALS.map(proposal => {
      // Simplified constraint check
      const passed = proposal.survivalScore >= 0.95;
      
      // Simplified utility (not the actual GDPO algorithm)
      const utility = passed ? 
        proposal.survivalScore * 100 + proposal.economicScore : -Infinity;

      return {
        proposal,
        passed,
        utility,
        reason: passed ? "PASS" : "SURVIVAL_CONSTRAINT_VIOLATION",
      };
    });

    // Select best passing proposal
    const validProposals = evaluations.filter(e => e.passed);
    if (validProposals.length === 0) {
      return createResult(startTime, sensors, avgFreq, true,
        "L3 VIOLATION: No proposals satisfy survival constraints");
    }

    const selected = validProposals.reduce((best, curr) =>
      curr.utility > best.utility ? curr : best
    );

    return createResult(
      startTime,
      sensors,
      avgFreq,
      false,
      `DISPATCHED: ${selected.proposal.action}`,
      selected.proposal.action,
      evaluations
    );

  } catch (error) {
    return safeNeutralFallback(`Exception: ${error}`);
  }
}

function createResult(
  startTime: number,
  sensors: number[],
  verifiedFreq: number | null,
  intercepted: boolean,
  message: string,
  finalAction: string = SAFE_NEUTRAL_POSITION,
  evaluations: Array<{
    proposal: Proposal;
    passed: boolean;
    utility: number;
    reason: string;
  }> = []
): HalCycleResult {
  return {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    sensors,
    verifiedFreq,
    proposalsEval: evaluations,
    finalAction,
    intercepted,
    message,
    executionTimeMs: performance.now() - startTime,
  };
}

// Re-export types
export type { HalCycleResult, SafetyConfig as SafetyConfig };

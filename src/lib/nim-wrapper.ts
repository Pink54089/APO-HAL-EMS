import type { HalCycleResult } from '../../shared/types';
import { SAFE_NEUTRAL_POSITION, SYSTEM_IDLE } from '../../shared/types';

export const NIM_CONSTANTS = {
  SAFE_NEUTRAL_POSITION,
  SYSTEM_IDLE,
  DATA_INJECTION_THRESHOLD: 0.02,
  NDIR_MISMATCH_THRESHOLD: 0.01,
  HEARTBEAT_TIMEOUT_MS: 16.6,
  UFLS_STAGE_1: 59.3,
  VOLTAGE_UPPER_LIMIT_PU: 1.05,
  VOLTAGE_LOWER_LIMIT_PU: 0.95,
} as const;

export function isNimRuntimeAvailable(): boolean {
  return false;
}

export function executeHalCycleNim(_sensors: number[]): HalCycleResult {
  throw new Error('Nim kernel not available in public release');
}

export function safeNeutralFallback(reason: string): HalCycleResult {
  return {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    intercepted: true,
    finalAction: SAFE_NEUTRAL_POSITION,
    message: `FALLBACK_CONSTANT: ${reason}`,
    klDivergence: 0.0,
    executionTimeMs: 0.0,
    evaluations: [],
  };
}

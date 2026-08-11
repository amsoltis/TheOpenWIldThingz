import type { RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

/**
 * Haptics carry the instructions the traveller cannot look at.
 *
 * On a packed train the phone is often in a pocket or held at hip height, and
 * the one thing that must land is "this is your stop". So the alert strength is
 * a property of the packet, not of the interaction: LIGHT_TAP is a page turn,
 * DOUBLE_JOLT means stand up, CONTINUOUS_ALERT means get off now.
 */
export type HapticKind = 'SELECTION' | 'IMPACT_LIGHT' | 'IMPACT_HEAVY' | 'NOTIFY_WARNING' | 'NOTIFY_ERROR';

export interface HapticStep {
  /** Milliseconds from the start of the sequence. */
  offsetMs: number;
  kind: HapticKind;
}

/**
 * The theme stores patterns in the platform vibration convention —
 * `[wait, buzz, wait, buzz, …]`. expo-haptics fires discrete events instead of
 * timed buzzes, so the buzz durations become the spacing between pulses.
 */
export function pulseOffsets(pattern: readonly number[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (let i = 0; i < pattern.length; i += 2) {
    cursor += pattern[i] ?? 0;
    offsets.push(cursor);
    cursor += pattern[i + 1] ?? 0;
  }
  return offsets;
}

export function hapticStepsFor(trigger: RouteCard['hapticPatternTrigger']): HapticStep[] {
  switch (trigger) {
    case 'LIGHT_TAP':
      return [{ offsetMs: 0, kind: 'IMPACT_LIGHT' }];

    case 'DOUBLE_JOLT':
      return pulseOffsets(SubwayTheme.hapticSequences.STATION_APPROACH_PATTERN).map((offsetMs) => ({
        offsetMs,
        kind: 'IMPACT_HEAVY' as const,
      }));

    case 'CONTINUOUS_ALERT': {
      const offsets = pulseOffsets(SubwayTheme.hapticSequences.CRITICAL_DESTINATION_ALERT);
      return offsets.map((offsetMs, index) => ({
        offsetMs,
        // The first pulse is the system error notification because it is the
        // strongest single event either platform will give us.
        kind: index === 0 ? ('NOTIFY_ERROR' as const) : ('IMPACT_HEAVY' as const),
      }));
    }

    default:
      // Every card change gets *something*. Silence on a swipe reads as a
      // dropped input and makes people swipe again, skipping a card.
      return [{ offsetMs: 0, kind: 'SELECTION' }];
  }
}

export function totalHapticDurationMs(steps: readonly HapticStep[]): number {
  return steps.reduce((max, step) => Math.max(max, step.offsetMs), 0);
}

import * as Haptics from 'expo-haptics';
import type { RouteCard } from '@streetlevel/shared';

import { hapticStepsFor, type HapticKind, type HapticStep } from './hapticPlan';

async function fire(kind: HapticKind): Promise<void> {
  switch (kind) {
    case 'SELECTION':
      return Haptics.selectionAsync();
    case 'IMPACT_LIGHT':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'IMPACT_HEAVY':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    case 'NOTIFY_WARNING':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'NOTIFY_ERROR':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

/**
 * Returns a cancel function. Card changes can outrun a CONTINUOUS_ALERT
 * sequence, and a jolt that belongs to a card the traveller has already swiped
 * past is worse than no jolt at all — it means "get off" while they are reading
 * something else.
 */
export function playHapticPattern(trigger: RouteCard['hapticPatternTrigger']): () => void {
  const steps: HapticStep[] = hapticStepsFor(trigger);
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const step of steps) {
    if (step.offsetMs === 0) {
      void fire(step.kind).catch(() => undefined);
      continue;
    }
    timers.push(
      setTimeout(() => {
        void fire(step.kind).catch(() => undefined);
      }, step.offsetMs),
    );
  }

  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}

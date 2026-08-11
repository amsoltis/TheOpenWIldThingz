/**
 * Where to stand on the platform.
 *
 * The packet gives a car index 1–11 (the contract's validator enforces that
 * range because NYC trains run 8–11 cars). The strip on screen always draws ten
 * cars: a fixed-length diagram is read at a glance, and a diagram whose length
 * changed per station would make "third box from the left" mean something
 * different on every card. Indices beyond the drawn train are clamped to the
 * last car rather than dropped, because "the very back" is still correct advice.
 */
export const TRAIN_CAR_COUNT = 10;

export function clampCarIndex(index: number, carCount: number = TRAIN_CAR_COUNT): number {
  if (!Number.isFinite(index)) return 1;
  const rounded = Math.round(index);
  if (rounded < 1) return 1;
  if (rounded > carCount) return carCount;
  return rounded;
}

export type CarZone = 'FRONT' | 'MIDDLE' | 'BACK';

export function carZone(index: number, carCount: number = TRAIN_CAR_COUNT): CarZone {
  const car = clampCarIndex(index, carCount);
  if (car <= carCount / 3) return 'FRONT';
  if (car <= (carCount * 2) / 3) return 'MIDDLE';
  return 'BACK';
}

const ZONE_WORDS: Record<CarZone, string> = {
  FRONT: 'toward the front of the train',
  MIDDLE: 'in the middle of the train',
  BACK: 'toward the back of the train',
};

export function carZoneText(index: number, carCount: number = TRAIN_CAR_COUNT): string {
  return ZONE_WORDS[carZone(index, carCount)];
}

/** 1-indexed car numbers for the strip, so the view never does its own arithmetic. */
export function carSlots(carCount: number = TRAIN_CAR_COUNT): number[] {
  return Array.from({ length: carCount }, (_, i) => i + 1);
}

export function carAccessibilityLabel(index: number, carCount: number = TRAIN_CAR_COUNT): string {
  const car = clampCarIndex(index, carCount);
  return `Stand at car ${car} of ${carCount}, ${carZoneText(car, carCount)}.`;
}

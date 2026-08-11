import { describe, expect, it } from 'vitest';

import {
  StopCounter,
  arrivalTolerance,
  shouldAsk,
  type MotionSample,
} from './stop-detector.js';

/**
 * Synthetic rides.
 *
 * A moving train and a stationary one differ in the *variance* of the
 * acceleration magnitude, not its mean — gravity dominates the mean in both
 * cases — so the traces model exactly that: a noisy signal around 1g while
 * running, and a much quieter one while stopped.
 *
 * Deterministic pseudo-random, so a failure is reproducible rather than a thing
 * that happens one run in fifty.
 */
function noise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
}

const HZ = 20;
const STEP = 1000 / HZ;

function segment(from: number, seconds: number, amplitude: number, rnd: () => number): MotionSample[] {
  const out: MotionSample[] = [];
  for (let i = 0; i < seconds * HZ; i++) {
    out.push({ t: from + i * STEP, magnitude: 1 + rnd() * amplitude });
  }
  return out;
}

const MOVING_AMPLITUDE = 0.22;
const STILL_AMPLITUDE = 0.012;

interface Leg { runSeconds: number; dwellSeconds: number }

function ride(legs: Leg[], seed = 7): MotionSample[] {
  const rnd = noise(seed);
  const out: MotionSample[] = [];
  let t = 0;
  for (const leg of legs) {
    const run = segment(t, leg.runSeconds, MOVING_AMPLITUDE, rnd);
    out.push(...run);
    t = (run.at(-1)?.t ?? t) + STEP;
    const dwell = segment(t, leg.dwellSeconds, STILL_AMPLITUDE, rnd);
    out.push(...dwell);
    t = (dwell.at(-1)?.t ?? t) + STEP;
  }
  // Pull away from the last platform, so the final dwell resolves.
  out.push(...segment(t, 10, MOVING_AMPLITUDE, rnd));
  return out;
}

function run(counter: StopCounter, samples: MotionSample[]): void {
  for (const s of samples) counter.push(s);
}

describe('StopCounter', () => {
  it('counts a clean three-stop ride', () => {
    const hops = [120, 90, 150];
    const counter = new StopCounter({ hopSeconds: hops });
    run(counter, ride([
      { runSeconds: 120, dwellSeconds: 25 },
      { runSeconds: 90, dwellSeconds: 25 },
      { runSeconds: 150, dwellSeconds: 25 },
    ]));

    const e = counter.estimate();
    expect(e.stopsCompleted).toBe(3);
    expect(e.arrived).toBe(true);
    expect(e.rejectedHolds).toBe(0);
    expect(shouldAsk(e)).toBe(false);
  });

  it('refuses to count a signal hold in a tunnel', () => {
    // The failure mode that makes this hard: the train stops for 40 seconds
    // nowhere near a station. To an accelerometer that is a platform.
    const counter = new StopCounter({ hopSeconds: [180, 120] });
    run(counter, ride([
      { runSeconds: 30, dwellSeconds: 40 },   // held at a signal, far too early
      { runSeconds: 150, dwellSeconds: 25 },  // the real first stop
      { runSeconds: 120, dwellSeconds: 25 },  // the real second stop
    ]));

    const e = counter.estimate();
    expect(e.rejectedHolds).toBe(1);
    expect(e.stopsCompleted).toBe(2);
  });

  it('says so when it has been rejecting things', () => {
    const counter = new StopCounter({ hopSeconds: [200] });
    run(counter, ride([
      { runSeconds: 20, dwellSeconds: 30 },
      { runSeconds: 25, dwellSeconds: 30 },
      { runSeconds: 155, dwellSeconds: 25 },
    ]));
    const e = counter.estimate();
    expect(e.rejectedHolds).toBeGreaterThanOrEqual(1);
    // Confidence has to fall, because the interface keys "ask, don't tell" off it.
    expect(e.confidence).toBeLessThan(1);
  });

  it('ignores a pause too short to be a station', () => {
    const counter = new StopCounter({ hopSeconds: [120] });
    run(counter, ride([
      { runSeconds: 60, dwellSeconds: 6 },   // crawling into the station
      { runSeconds: 60, dwellSeconds: 25 },  // actually stopping
    ]));
    expect(counter.estimate().stopsCompleted).toBe(1);
  });

  it('does not run past the end of the ride', () => {
    const counter = new StopCounter({ hopSeconds: [100] });
    run(counter, ride([
      { runSeconds: 100, dwellSeconds: 25 },
      { runSeconds: 100, dwellSeconds: 25 },
      { runSeconds: 100, dwellSeconds: 25 },
    ]));
    const e = counter.estimate();
    expect(e.stopsCompleted).toBe(1);
    expect(e.arrived).toBe(true);
  });

  it('reports UNKNOWN until it has seen enough to judge', () => {
    const counter = new StopCounter({ hopSeconds: [120] });
    counter.push({ t: 0, magnitude: 1 });
    counter.push({ t: 50, magnitude: 1 });
    expect(counter.estimate().state).toBe('UNKNOWN');
  });

  it('lets the traveller overrule it', () => {
    const counter = new StopCounter({ hopSeconds: [120, 120, 120] });
    run(counter, ride([{ runSeconds: 20, dwellSeconds: 40 }]));
    expect(counter.estimate().confidence).toBeLessThan(1);

    // Nothing beats being told. The escape hatch is what stops a drifting
    // estimate compounding into nonsense over a twenty-stop ride.
    counter.correctTo(2, 500_000);
    const e = counter.estimate();
    expect(e.stopsCompleted).toBe(2);
    expect(e.confidence).toBe(1);
    expect(shouldAsk(e)).toBe(false);
  });

  it('tolerates a late train without losing the count', () => {
    // Schedules are medians. A hop that should take 120s taking 160s is an
    // ordinary Tuesday, and rejecting it would desynchronise the whole ride.
    const counter = new StopCounter({ hopSeconds: [120, 120] });
    run(counter, ride([
      { runSeconds: 160, dwellSeconds: 25 },
      { runSeconds: 155, dwellSeconds: 25 },
    ]));
    const e = counter.estimate();
    expect(e.stopsCompleted).toBe(2);
    expect(e.rejectedHolds).toBe(0);
  });
});

describe('arrivalTolerance', () => {
  it('never drops below three quarters of a minute', () => {
    // Short hops are where a fixed percentage would be uselessly tight.
    expect(arrivalTolerance(30)).toBe(45_000);
  });

  it('widens with the length of the hop', () => {
    expect(arrivalTolerance(300)).toBeGreaterThan(arrivalTolerance(120));
  });
});

describe('shouldAsk', () => {
  it('asks rather than tells once confidence has eroded', () => {
    expect(shouldAsk({ stopsCompleted: 3, confidence: 0.5, state: 'MOVING', rejectedHolds: 2, arrived: false })).toBe(true);
    expect(shouldAsk({ stopsCompleted: 3, confidence: 0.9, state: 'MOVING', rejectedHolds: 0, arrived: false })).toBe(false);
  });
});

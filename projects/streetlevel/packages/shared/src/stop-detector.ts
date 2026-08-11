/**
 * Counting stops from the phone's motion sensor, with no signal.
 *
 * The insight this rests on: stop-counting is only hard if you do not know what
 * to expect. We do. The station graph carries the median scheduled running time
 * for every hop, so by the time a traveller is underground the client is holding
 * a sequence of expected durations. That turns "is this a station?" from a
 * classification problem into a matched filter against a known sequence.
 *
 * The failure mode that makes this non-trivial is specific to this system:
 * **trains stop in tunnels all the time.** A dwell on its own means nothing —
 * held at a signal outside the station looks exactly like arrived at the
 * station, to an accelerometer. The timing prior is what separates them, and it
 * is the whole reason this is worth building rather than buying.
 *
 * Zero dependencies and no I/O: the caller owns the sensor subscription, this
 * owns the arithmetic. That is what makes it testable without a phone — which
 * matters, because it has never run on one.
 */

export interface MotionSample {
  /** Milliseconds, monotonic. Only differences are used. */
  t: number;
  /** Acceleration magnitude in g. `Math.hypot(x, y, z)` straight off the sensor. */
  magnitude: number;
}

export type RideState = 'UNKNOWN' | 'MOVING' | 'STOPPED';

export interface StopEstimate {
  /** Stops confirmed since boarding. */
  stopsCompleted: number;
  /** 0..1. Falls as the evidence gets muddier; never rises back to certainty. */
  confidence: number;
  state: RideState;
  /** Dwells rejected because they came at the wrong time — signal holds. */
  rejectedHolds: number;
  /** True once the count reaches the ride's last stop. */
  arrived: boolean;
}

export interface StopCounterOptions {
  /**
   * Expected seconds for each hop, in order, from the compiled packet. The
   * length is the number of stops on the ride.
   */
  hopSeconds: readonly number[];
  /** Rolling window over which movement is judged. */
  windowMs?: number;
  /**
   * Sensor noise, in g, below which the train is considered still. A phone on a
   * stationary train is not perfectly quiet — people move, the car rocks — so
   * this is well above zero.
   */
  stillnessThreshold?: number;
  /** Hysteresis: movement has to exceed this to count as under way again. */
  motionThreshold?: number;
  /** Shorter dwells than this are traffic, not a station. */
  minDwellMs?: number;
}

const DEFAULTS = {
  windowMs: 3000,
  // These are starting points from the physics, not calibrated constants. They
  // are the first thing that should change once there is a real trace from a
  // real train, and they are options precisely so that can happen without a
  // rewrite.
  stillnessThreshold: 0.018,
  motionThreshold: 0.035,
  minDwellMs: 12000,
};

/**
 * How far off the expected arrival a dwell can be and still be believed.
 *
 * Generous, and deliberately so: schedules are medians, trains run late, and
 * rejecting a real station is worse than accepting a long signal hold. A
 * rejected station desynchronises the count for the rest of the ride; an
 * accepted hold costs one wrong stop that the next real arrival corrects.
 */
export function arrivalTolerance(expectedSeconds: number): number {
  return Math.max(45_000, expectedSeconds * 1000 * 0.55);
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / values.length;
  let acc = 0;
  for (const v of values) acc += (v - mean) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

export class StopCounter {
  private readonly opts: Required<StopCounterOptions>;
  private window: MotionSample[] = [];
  private state: RideState = 'UNKNOWN';
  private stopsCompleted = 0;
  private rejectedHolds = 0;
  private confidence = 1;
  private dwellStartedAt: number | null = null;
  /** When the current hop began — boarding, or the last confirmed departure. */
  private hopStartedAt: number | null = null;

  constructor(options: StopCounterOptions) {
    this.opts = { ...DEFAULTS, ...options } as Required<StopCounterOptions>;
  }

  push(sample: MotionSample): void {
    if (this.hopStartedAt === null) this.hopStartedAt = sample.t;

    this.window.push(sample);
    const cutoff = sample.t - this.opts.windowMs;
    while (this.window.length > 0 && this.window[0]!.t < cutoff) this.window.shift();
    // A window that has not filled yet cannot be judged; saying UNKNOWN is more
    // honest than calling a half-second of samples "stopped".
    if (sample.t - this.window[0]!.t < this.opts.windowMs * 0.6) return;

    const spread = standardDeviation(this.window.map((s) => s.magnitude));

    if (this.state !== 'STOPPED' && spread < this.opts.stillnessThreshold) {
      this.state = 'STOPPED';
      this.dwellStartedAt = sample.t;
      return;
    }

    if (this.state === 'STOPPED' && spread > this.opts.motionThreshold) {
      const dwellMs = this.dwellStartedAt === null ? 0 : sample.t - this.dwellStartedAt;
      this.state = 'MOVING';
      this.resolveDwell(sample.t, dwellMs);
      this.dwellStartedAt = null;
      return;
    }

    if (this.state === 'UNKNOWN' && spread >= this.opts.stillnessThreshold) {
      this.state = 'MOVING';
    }
  }

  private resolveDwell(departedAt: number, dwellMs: number): void {
    if (dwellMs < this.opts.minDwellMs) {
      // Too short to be a station stop with doors. Not even worth doubting.
      return;
    }
    const expected = this.opts.hopSeconds[this.stopsCompleted];
    if (expected === undefined) return; // ride already complete

    const arrivedAt = departedAt - dwellMs;
    const elapsed = arrivedAt - (this.hopStartedAt ?? arrivedAt);
    const drift = Math.abs(elapsed - expected * 1000);

    if (drift > arrivalTolerance(expected)) {
      // A long stop at the wrong time is the classic tunnel hold. Counting it
      // would desynchronise every remaining stop on the ride.
      this.rejectedHolds += 1;
      this.confidence = Math.max(0.25, this.confidence - 0.12);
      return;
    }

    this.stopsCompleted += 1;
    this.hopStartedAt = departedAt;
    // Even a good match erodes certainty a little. Twelve stops of accumulated
    // inference is not as trustworthy as one, and the interface should say so.
    const closeness = 1 - Math.min(1, drift / arrivalTolerance(expected));
    this.confidence = Math.max(0.3, Math.min(this.confidence, 0.55 + 0.45 * closeness));
  }

  estimate(): StopEstimate {
    return {
      stopsCompleted: this.stopsCompleted,
      confidence: this.confidence,
      state: this.state,
      rejectedHolds: this.rejectedHolds,
      arrived: this.stopsCompleted >= this.opts.hopSeconds.length,
    };
  }

  /**
   * The traveller says where they actually are. Nothing beats that, so the
   * count is reset to it and confidence restored — this is the escape hatch
   * that keeps a drifting estimate from compounding into nonsense.
   */
  correctTo(stopsCompleted: number, at: number): void {
    this.stopsCompleted = Math.max(0, Math.min(stopsCompleted, this.opts.hopSeconds.length));
    this.hopStartedAt = at;
    this.dwellStartedAt = null;
    this.confidence = 1;
  }
}

/**
 * Whether an estimate is good enough to show as a claim rather than a question.
 *
 * The rule from the roadmap, encoded: sensing may offer a position, never
 * assert one. Below this the interface must ask rather than tell, because a
 * confidently wrong position destroys trust exactly when the traveller has no
 * way to check us.
 */
export const SENSING_ASSERTION_FLOOR = 0.7;

export function shouldAsk(estimate: StopEstimate): boolean {
  return estimate.confidence < SENSING_ASSERTION_FLOOR;
}

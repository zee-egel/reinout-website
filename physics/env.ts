// environment that normalizes physics for the RL model
import { DinoPhysics } from "./dino-physics";

export enum Action {
  Idle = 0,
  Jump = 1,
  Duck = 2, // reserved for future
}

export type Obs = Float32Array;

export type StepOut = {
  obs: Obs;
  reward: number;
  done: boolean;
  info?: { score: number };
};

export const OBS_SIZE = 7; // [yRel, speed, dist, tti, width, height, grounded]

export type EnvOptions = {
  frameSkip?: number; // repeat action K frames
};

export class DinoEnv {
  readonly physics: DinoPhysics;
  readonly frameSkip: number;

  private lastScore = 0;
  private terminated = false;
  // Reward shaping parameters
  private readonly surviveReward = 0.003; // smaller survival reward
  private readonly progressScale = 0.0005; // smaller distance shaping
  private readonly clearReward = 2.0; // stronger signal when clearing an obstacle
  private readonly jumpProximityBonus = 0.05; // stronger incentive to time jumps
  private readonly jumpFarPenalty = -0.02; // stronger penalty against random jumps
  private readonly jumpProximityThreshold = 0.25; // normalized distance

  constructor(opts: EnvOptions = {}) {
    this.physics = new DinoPhysics();
    this.frameSkip = Math.max(1, Math.floor(opts.frameSkip ?? 2));
  }

  reset(): Obs {
    this.physics.reset();
    this.lastScore = 0;
    this.terminated = false;
    return this.observe();
  }

  step(action: Action): StepOut {
    if (this.terminated) {
      // Convention: require reset() after done
      const obs = this.observe();
      return { obs, reward: 0, done: true, info: { score: this.physics.score } };
    }

    // Repeat action for frameSkip frames; trigger jump only on first frame
    let done = false;
    // Count obstacles already passed before stepping
    const preCleared = (this.physics as any).obstaclesCleared as number;
    // Whether an obstacle is within proximity ahead right now
    let nearAhead = false;
    for (const ob of this.physics.obstacles) {
      if (ob.x + ob.width > this.physics.dinoX) {
        const distNorm = Math.max(0, Math.min(1, (ob.x - this.physics.dinoX) / this.physics.worldWidth));
        nearAhead = distNorm < this.jumpProximityThreshold;
        break;
      }
    }
    for (let k = 0; k < this.frameSkip; k++) {
      const res = this.physics.step({ jump: action === Action.Jump && k === 0, duck: action === Action.Duck }, 1);
      if (res.done) {
        done = true;
        break;
      }
    }

    const obs = this.observe();

    // Reward shaping
    const score = this.physics.score;
    const deltaScore = Math.max(0, score - this.lastScore);
    this.lastScore = score;
    // Base rewards: survival + progress
    let reward = this.surviveReward * this.frameSkip + this.progressScale * deltaScore;
    // Obstacles cleared since before step
    const postCleared = (this.physics as any).obstaclesCleared as number;
    const clearedDelta = Math.max(0, postCleared - preCleared);
    reward += this.clearReward * clearedDelta;
    // Encourage jumping near obstacles; discourage jumping randomly
    if (action === Action.Jump) {
      reward += nearAhead ? this.jumpProximityBonus : this.jumpFarPenalty;
    }
    if (done) reward = -1.0;

    if (done) this.terminated = true;
    return { obs, reward, done, info: { score } };
  }

  private observe(): Obs {
    return buildObservationFromPhysics(this.physics);
  }
}

// Exported helper to build observations from a DinoPhysics instance.
export function buildObservationFromPhysics(p: DinoPhysics): Obs {
  const yRel = p.dinoY / p.groundY;
  const speedNorm = p.speed / (p.baseSpeed + 8);

  // Distances and time-to-impact for the nearest obstacle
  let distNorm = 1;
  let ttiNorm = 1; // normalized to ~1 second horizon
  let w = 0;
  let h = 0;
  for (const ob of p.obstacles) {
    if (ob.x + ob.width > p.dinoX) {
      const distPx = Math.max(0, ob.x - p.dinoX);
      distNorm = Math.max(0, Math.min(1, distPx / p.worldWidth));
      const ttiFrames = distPx / Math.max(1e-6, p.speed);
      ttiNorm = Math.max(0, Math.min(1, ttiFrames / 60));
      w = Math.max(0, Math.min(1, ob.width / 60));
      h = Math.max(0, Math.min(1, ob.height / 60));
      break;
    }
  }

  const grounded = p.dinoY >= p.groundY ? 1 : 0;

  const obs = new Float32Array(OBS_SIZE);
  obs[0] = yRel;
  obs[1] = speedNorm;
  obs[2] = distNorm;
  obs[3] = ttiNorm;
  obs[4] = w;
  obs[5] = h;
  obs[6] = grounded;
  return obs;
}

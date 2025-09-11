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

export const OBS_SIZE = 6; // [yRel, speed, dist, width, height, grounded]

export type EnvOptions = {
  frameSkip?: number; // repeat action K frames
};

export class DinoEnv {
  readonly physics: DinoPhysics;
  readonly frameSkip: number;

  private lastScore = 0;
  private terminated = false;

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
    let reward = 0.01 * this.frameSkip + 0.001 * deltaScore; // survive + progress
    if (done) reward = -1.0;

    if (done) this.terminated = true;
    return { obs, reward, done, info: { score } };
  }

  private observe(): Obs {
    const p = this.physics;
    // Dino vertical position relative to ground (1 at ground, <1 in air)
    const yRel = p.dinoY / p.groundY; // ~[0.7, 1.0]
    const speedNorm = p.speed / (p.baseSpeed + 8);

    // Next obstacle features
    let dist = 1;
    let w = 0;
    let h = 0;
    for (const ob of p.obstacles) {
      if (ob.x + ob.width > p.dinoX) {
        dist = Math.max(0, Math.min(1, (ob.x - p.dinoX) / p.worldWidth));
        w = Math.max(0, Math.min(1, ob.width / 60));
        h = Math.max(0, Math.min(1, ob.height / 60));
        break;
      }
    }

    const grounded = p.dinoY >= p.groundY ? 1 : 0;

    const obs = new Float32Array(OBS_SIZE);
    obs[0] = yRel;
    obs[1] = speedNorm;
    obs[2] = dist;
    obs[3] = w;
    obs[4] = h;
    obs[5] = grounded;
    return obs;
  }
}

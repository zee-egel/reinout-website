// DQN + replay buffer with TensorFlow.js backend.
import * as tf from "@tensorflow/tfjs";

export type Obs = Float32Array;

export type Transition = {
  obs: Obs;
  action: number;
  reward: number;
  nextObs: Obs;
  done: boolean;
};

export class ReplayBuffer {
  private buf: Transition[] = [];
  private idx = 0;
  constructor(private capacity: number) {}

  add(t: Transition) {
    if (this.buf.length < this.capacity) this.buf.push(t);
    else this.buf[this.idx] = t;
    this.idx = (this.idx + 1) % this.capacity;
  }

  size() {
    return this.buf.length;
  }

  sample(n: number): Transition[] {
    const out: Transition[] = [];
    for (let i = 0; i < n; i++) {
      out.push(this.buf[(Math.random() * this.buf.length) | 0]);
    }
    return out;
  }
}

export interface Agent {
  readonly actionSize: number;
  epsilon: number;
  selectAction(obs: Obs): number | Promise<number>;
  observe(t: Transition): void;
  train(): number | Promise<number | undefined> | undefined; // returns loss if training occurred
  save?(): Promise<void> | void;
  load?(): Promise<void> | void;
}

// Simple baseline that explores randomly; training is a no-op.
export class RandomAgent implements Agent {
  epsilon = 1.0;
  constructor(public readonly actionSize: number) {}
  selectAction(_obs: Obs): number {
    return Math.floor(Math.random() * this.actionSize);
  }
  observe(_t: Transition) {}
  train(): undefined {
    return undefined;
  }
}

export type DQNOptions = {
  obsSize: number;
  actionSize: number;
  hiddenSizes?: number[]; // default [128, 128]
  gamma?: number; // 0.99
  lr?: number; // 1e-3
  batchSize?: number; // 128
  updateEvery?: number; // 4 (train frequency)
  targetSync?: number; // hard update interval steps (e.g., 2000)
  tau?: number; // soft update for target (0 disables)
  warmup?: number; // minimal replay before training (e.g., 1000)
  replaySize?: number; // 100k
};

export class DQN implements Agent {
  epsilon = 1.0;
  readonly actionSize: number;
  private readonly obsSize: number;
  private readonly hiddenSizes: number[];
  private readonly gamma: number;
  private readonly batchSize: number;
  private readonly updateEvery: number;
  private readonly targetSync: number;
  private readonly tau: number;
  private readonly warmup: number;
  private readonly replay: ReplayBuffer;
  private steps = 0;

  private online: tf.LayersModel;
  private target: tf.LayersModel;
  private optimizer: tf.Optimizer;

  constructor(opts: DQNOptions) {
    this.obsSize = opts.obsSize;
    this.actionSize = opts.actionSize;
    this.hiddenSizes = opts.hiddenSizes ?? [128, 128];
    this.gamma = opts.gamma ?? 0.99;
    this.batchSize = opts.batchSize ?? 128;
    this.updateEvery = opts.updateEvery ?? 4;
    this.targetSync = opts.targetSync ?? 2000;
    this.tau = opts.tau ?? 0.0;
    this.warmup = opts.warmup ?? 1000;
    this.replay = new ReplayBuffer(opts.replaySize ?? 100_000);

    this.online = this.buildNet();
    this.target = this.buildNet();
    this.syncTargetHard();
    this.optimizer = tf.train.adam(opts.lr ?? 1e-3);
  }

  private buildNet(): tf.LayersModel {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [this.obsSize], units: this.hiddenSizes[0], activation: "relu" }));
    for (let i = 1; i < this.hiddenSizes.length; i++) {
      model.add(tf.layers.dense({ units: this.hiddenSizes[i], activation: "relu" }));
    }
    model.add(tf.layers.dense({ units: this.actionSize, activation: "linear" }));
    model.compile({ optimizer: tf.train.adam(1e-3), loss: tf.losses.huberLoss });
    return model;
  }

  private syncTargetHard() {
    const w = this.online.getWeights();
    this.target.setWeights(w.map((x) => x.clone()));
  }

  private syncTargetSoft(tau: number) {
    const wO = this.online.getWeights();
    const wT = this.target.getWeights();
    const blended = wO.map((wo, i) => tf.add(tf.mul(wo, tau), tf.mul(wT[i], 1 - tau)));
    this.target.setWeights(blended);
    wT.forEach((t) => t.dispose());
  }

  selectAction(obs: Obs): number {
    if (Math.random() < this.epsilon) return Math.floor(Math.random() * this.actionSize);
    return tf.tidy(() => {
      const x = tf.tensor2d(obs as unknown as number[], [1, this.obsSize]);
      const q = this.online.predict(x) as tf.Tensor2D;
      const argmax = q.argMax(1).dataSync()[0];
      return argmax;
    });
  }

  observe(t: Transition) {
    this.replay.add(t);
  }

  train(): number | undefined {
    this.steps++;
    if (this.replay.size() < this.warmup) return undefined;
    if (this.steps % this.updateEvery !== 0) return undefined;

    const batch = this.replay.sample(this.batchSize);
    const obsBatch = tf.tensor2d(batch.map((b) => Array.from(b.obs)), [batch.length, this.obsSize]);
    const nextObsBatch = tf.tensor2d(batch.map((b) => Array.from(b.nextObs)), [batch.length, this.obsSize]);
    const actions = tf.tensor1d(batch.map((b) => b.action), "int32");
    const rewards = tf.tensor1d(batch.map((b) => b.reward));
    const dones = tf.tensor1d(batch.map((b) => (b.done ? 1 : 0)));

    const lossVal = this.optimizer.minimize(() => {
      const qAll = this.online.apply(obsBatch, { training: true }) as tf.Tensor2D;
      const q = tf.mul(qAll, tf.oneHot(actions, this.actionSize).toFloat()).sum(1);

      const nextQAllOnline = this.online.predict(nextObsBatch) as tf.Tensor2D;
      const nextActions = nextQAllOnline.argMax(1);
      const nextQAllTarget = this.target.predict(nextObsBatch) as tf.Tensor2D;
      const nextQ = tf.mul(nextQAllTarget, tf.oneHot(nextActions, this.actionSize).toFloat()).sum(1);
      const targetQ = rewards.add(nextQ.mul(this.gamma).mul(tf.scalar(1).sub(dones)));

      const loss = tf.losses.huberLoss(targetQ, q);
      return loss as tf.Scalar;
    }, true) as tf.Scalar | null;

    const lossNum = lossVal ? lossVal.dataSync()[0] : undefined;

    // Target network updates
    if (this.tau > 0) this.syncTargetSoft(this.tau);
    else if (this.steps % this.targetSync === 0) this.syncTargetHard();

    // Cleanup
    obsBatch.dispose();
    nextObsBatch.dispose();
    actions.dispose();
    rewards.dispose();
    dones.dispose();

    return lossNum;
  }

  async save() {
    await this.online.save("indexeddb://dino-dqn-online");
    await this.target.save("indexeddb://dino-dqn-target");
  }

  async load() {
    try {
      this.online = (await tf.loadLayersModel("indexeddb://dino-dqn-online")) as tf.LayersModel;
      this.target = (await tf.loadLayersModel("indexeddb://dino-dqn-target")) as tf.LayersModel;
    } catch (e) {
      // ignore if not found
    }
  }
}

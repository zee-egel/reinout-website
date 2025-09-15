/// <reference lib="webworker" />
import { DinoEnv, Action, OBS_SIZE } from "../physics/env";
import {
  DQN,
  RandomAgent,
  type Agent,
  type Obs,
  type Transition,
} from "../model/dqn";

type StartMsg = {
  type: "start";
  episodes?: number;
  maxSteps?: number;
  frameSkip?: number;
  epsilonStart?: number;
  epsilonEnd?: number;
  epsilonDecayEpisodes?: number;
  highScoreSaveThreshold?: number;
};

type StopMsg = { type: "stop" };
type EvalMsg = { type: "eval"; episodes?: number; maxSteps?: number };

type InMsg = StartMsg | StopMsg | EvalMsg;

let shouldStop = false;
let currentAgent: Agent | null = null;

function toAction(idx: number): Action {
  return idx === 1 ? Action.Jump : Action.Idle; // 2 actions for now
}

async function trainLoop(opts: StartMsg) {
  const env = new DinoEnv({ frameSkip: opts.frameSkip ?? 2 });
  const actionSize = 2; // Idle, Jump
  const agent: Agent = new DQN({
    obsSize: OBS_SIZE,
    actionSize,
    hiddenSizes: [128, 128],
    gamma: 0.99,
    lr: 5e-4,
    batchSize: 64,
    updateEvery: 2,
    targetSync: 2000,
    tau: 0.005,
    warmup: 500,
    replaySize: 100_000,
  });
  agent.epsilon = opts.epsilonStart ?? 1.0;
  currentAgent = agent;

  const episodes = opts.episodes ?? 50;
  const maxSteps = opts.maxSteps ?? 2000;
  const epsEnd = opts.epsilonEnd ?? 0.05;
  const epsDecay = Math.max(1, opts.epsilonDecayEpisodes ?? episodes);

  shouldStop = false;
  let lastFrameAt = 0;
  let bestScore = 0;
  const saveThreshold =
    typeof opts.highScoreSaveThreshold === "number"
      ? opts.highScoreSaveThreshold
      : Number.POSITIVE_INFINITY;
  let hasAutoSaved = false;

  for (let ep = 1; ep <= episodes && !shouldStop; ep++) {
    let obs = env.reset();
    let totalReward = 0;
    let steps = 0;

    for (; steps < maxSteps; steps++) {
      // Epsilon-greedy over agent policy
      let actionIdx: number;
      if (Math.random() < agent.epsilon)
        actionIdx = (Math.random() * actionSize) | 0;
      else actionIdx = await agent.selectAction(obs as Obs);

      const { obs: nextObs, reward, done } = env.step(toAction(actionIdx));

      const transition: Transition = {
        obs: obs as Obs,
        action: actionIdx,
        reward,
        nextObs: nextObs as Obs,
        done,
      };
      agent.observe(transition);
      await agent.train();

      totalReward += reward;
      obs = nextObs;

      // Track best obstacles cleared and auto-save if threshold reached
      const p: any = (env as any).physics;
      const cleared: number = p.obstaclesCleared ?? 0;
      if (cleared > bestScore) {
        bestScore = cleared;
        if (
          !hasAutoSaved &&
          bestScore >= saveThreshold &&
          (agent as any).save
        ) {
          try {
            await (agent as any).save();
            hasAutoSaved = true;
            (self as any).postMessage({ type: "autosaved", bestScore });
          } catch {}
        }
      }

      // Stream a throttled frame to visualize training
      const now = performance.now();
      if (now - lastFrameAt > 50) {
        lastFrameAt = now;
        (self as any).postMessage({
          type: "frame",
          episode: ep,
          step: steps,
          epsilon: agent.epsilon,
          state: {
            dinoX: p.dinoX,
            dinoY: p.dinoY,
            groundY: p.groundY,
            worldWidth: p.worldWidth,
            worldHeight: p.worldHeight,
            speed: p.speed,
            score: p.score,
            cleared,
            obstacles: p.obstacles,
            done,
          },
          bestScore,
        });
      }
      if (done) break;
    }

    // Episode metrics
    const pEnd: any = (env as any).physics;
    const episodeCleared: number = pEnd.obstaclesCleared ?? 0;

    // Anneal epsilon linearly
    const frac = Math.min(1, ep / epsDecay);
    agent.epsilon = (opts.epsilonStart ?? 1) * (1 - frac) + epsEnd * frac;

    (self as any).postMessage({
      type: "progress",
      episode: ep,
      steps,
      return: totalReward,
      epsilon: agent.epsilon,
      bestScore,
      episodeCleared,
    });
  }

  (self as any).postMessage({ type: "done" });
}

async function evalLoop(opts: EvalMsg) {
  const env = new DinoEnv({ frameSkip: 2 });
  const actionSize = 2;
  const agent: Agent = new RandomAgent(actionSize);
  agent.epsilon = 0.0;

  const episodes = opts.episodes ?? 5;
  const maxSteps = opts.maxSteps ?? 4000;

  for (let ep = 1; ep <= episodes; ep++) {
    let obs = env.reset();
    let steps = 0;
    for (; steps < maxSteps; steps++) {
      const actionIdx = await agent.selectAction(obs as Obs);
      const { obs: nextObs, done } = env.step(toAction(actionIdx));
      obs = nextObs;
      if (done) break;
    }
    (self as any).postMessage({ type: "eval", episode: ep, steps });
  }
  (self as any).postMessage({ type: "done" });
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === "start") trainLoop(msg);
  else if (msg.type === "stop") shouldStop = true;
  else if (msg.type === "eval") evalLoop(msg);
};

// Optional: allow UI to trigger save of current model
self.addEventListener("message", async (ev: MessageEvent<any>) => {
  const msg = ev.data;
  if (msg && msg.type === "save") {
    try {
      if (currentAgent && currentAgent.save) {
        await currentAgent.save();
        (self as any).postMessage({ type: "saved" });
      }
    } catch (e) {
      (self as any).postMessage({
        type: "error",
        error: (e as Error).message || String(e),
      });
    }
  }
});

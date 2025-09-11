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
};

type StopMsg = { type: "stop" };
type EvalMsg = { type: "eval"; episodes?: number; maxSteps?: number };

type InMsg = StartMsg | StopMsg | EvalMsg;

let shouldStop = false;

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
    lr: 1e-3,
    batchSize: 128,
    updateEvery: 4,
    targetSync: 2000,
    tau: 0.0,
    warmup: 1000,
    replaySize: 100_000,
  });
  agent.epsilon = opts.epsilonStart ?? 1.0;

  const episodes = opts.episodes ?? 50;
  const maxSteps = opts.maxSteps ?? 2000;
  const epsEnd = opts.epsilonEnd ?? 0.05;
  const epsDecay = Math.max(1, opts.epsilonDecayEpisodes ?? episodes);

  shouldStop = false;

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

      const {
        obs: nextObs,
        reward,
        done,
        info,
      } = env.step(toAction(actionIdx));

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
      if (done) break;
    }

    // Anneal epsilon linearly
    const frac = Math.min(1, ep / epsDecay);
    agent.epsilon = (opts.epsilonStart ?? 1) * (1 - frac) + epsEnd * frac;

    (self as any).postMessage({
      type: "progress",
      episode: ep,
      steps,
      return: totalReward,
      epsilon: agent.epsilon,
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

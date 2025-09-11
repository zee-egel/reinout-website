import React, { useEffect, useRef, useState } from "react";

type ProgressMsg = {
  type: "progress";
  episode: number;
  steps: number;
  return: number;
  epsilon: number;
};

type DoneMsg = { type: "done" };
type EvalMsg = { type: "eval"; episode: number; steps: number };

type WorkerMsg = ProgressMsg | DoneMsg | EvalMsg;

export function RLControls() {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [episode, setEpisode] = useState(0);
  const [epsilon, setEpsilon] = useState(0);
  const [ret, setRet] = useState(0);
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  function ensureWorker() {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/rl.worker.ts", import.meta.url),
        { type: "module" }
      );
      workerRef.current.onmessage = (e: MessageEvent<WorkerMsg>) => {
        const msg = e.data;
        if (msg.type === "progress") {
          setEpisode(msg.episode);
          setSteps(msg.steps);
          setRet(Number(msg.return.toFixed(3)));
          setEpsilon(Number(msg.epsilon.toFixed(3)));
        } else if (msg.type === "done") {
          setRunning(false);
        }
      };
    }
    return workerRef.current!;
  }

  function start() {
    const w = ensureWorker();
    setRunning(true);
    setEpisode(0);
    setEpsilon(0);
    setRet(0);
    setSteps(0);
    w.postMessage({
      type: "start",
      episodes: 50,
      maxSteps: 3000,
      frameSkip: 2,
      epsilonStart: 1.0,
      epsilonEnd: 0.05,
      epsilonDecayEpisodes: 50,
    });
  }

  function stop() {
    if (workerRef.current) workerRef.current.postMessage({ type: "stop" });
  }

  function evalGreedy() {
    const w = ensureWorker();
    w.postMessage({ type: "eval", episodes: 5, maxSteps: 4000 });
  }

  return (
    <div className="mt-6 p-3 border rounded text-sm max-w-[800px] w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-semibold">RL Trainer</div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded bg-gray-900 text-white disabled:opacity-50 dark:bg-gray-100 dark:text-black"
            onClick={start}
            disabled={running}
          >
            Start
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800"
            onClick={stop}
            disabled={!running}
          >
            Stop
          </button>
          <button className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800" onClick={evalGreedy}>
            Eval (greedy)
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Episode" value={episode} />
        <Metric label="Steps" value={steps} />
        <Metric label="Return" value={ret} />
        <Metric label="Epsilon" value={epsilon} />
      </div>
      <div className="mt-2 text-gray-500">
        Training runs headless in a Web Worker using DQN over the physics env.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 rounded border text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-mono">{value}</div>
    </div>
  );
}


import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type ProgressMsg = { type: "progress"; episode: number; steps: number; return: number; epsilon: number; bestScore: number; episodeCleared: number };
type DoneMsg = { type: "done" };
type FrameMsg = {
  type: "frame";
  episode: number;
  step: number;
  epsilon: number;
  state: {
    dinoX: number;
    dinoY: number;
    groundY: number;
    worldWidth: number;
    worldHeight: number;
    speed: number;
    score: number;
    cleared: number;
    obstacles: { x: number; width: number; height: number }[];
    done: boolean;
  };
  bestScore: number;
};

type AutoSavedMsg = { type: "autosaved"; bestScore: number };
type WorkerMsg = ProgressMsg | DoneMsg | FrameMsg | AutoSavedMsg;

export function RLControls() {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [episode, setEpisode] = useState(0);
  const [epsilon, setEpsilon] = useState(0);
  const [ret, setRet] = useState(0);
  const [steps, setSteps] = useState(0);
  const [best, setBest] = useState(0);
  const [saveAt, setSaveAt] = useState(500);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scores, setScores] = useState<number[]>([]);

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
          setBest(msg.bestScore ?? 0);
          setScores((arr) => {
            const next = arr.concat(msg.episodeCleared ?? 0);
            // Keep last 300 for the graph
            return next.length > 300 ? next.slice(next.length - 300) : next;
          });
        } else if (msg.type === "frame") {
          drawFrame(msg);
          setBest(msg.bestScore ?? 0);
        } else if (msg.type === "autosaved") {
          // Optionally, show a toast or console message
          console.log(`Model auto-saved at score ${msg.bestScore}`);
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
    setScores([]);
    w.postMessage({
      type: "start",
      episodes: 100000,
      maxSteps: 2000,
      frameSkip: 3,
      epsilonStart: 1.0,
      epsilonEnd: 0.1,
      epsilonDecayEpisodes: 200,
      highScoreSaveThreshold: Number(saveAt) || 0,
    });
  }

  function drawFrame(msg: FrameMsg) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { state } = msg;
    // Resize once
    if (canvas.width === 0 || canvas.height === 0) {
      const scale = Math.min(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = state.worldWidth * scale;
      canvas.height = state.worldHeight * scale;
      canvas.style.width = state.worldWidth + "px";
      canvas.style.height = state.worldHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scale, scale);
    }
    // Background
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
    ctx.fillRect(0, 0, state.worldWidth, state.worldHeight);
    ctx.strokeStyle = getComputedStyle(document.body).color || "#111";
    ctx.lineWidth = 2;
    // Ground
    ctx.beginPath();
    ctx.moveTo(0, state.groundY + 10);
    ctx.lineTo(state.worldWidth, state.groundY + 10);
    ctx.stroke();
    // Obstacles
    ctx.fillStyle = ctx.strokeStyle as string;
    for (const ob of state.obstacles) {
      ctx.fillRect(ob.x, state.groundY + 10 - ob.height, ob.width, ob.height);
    }
    // Dino
    drawDino(ctx, state.dinoX, state.dinoY, msg.step);
    // HUD
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`Obs ${state.cleared ?? 0}`, state.worldWidth - 12, 22);
    ctx.textAlign = "left";
    ctx.fillText(`Ep ${msg.episode}  eps ${msg.epsilon.toFixed(2)}`, 12, 22);
  }

  function drawDino(ctx: CanvasRenderingContext2D, x: number, y: number, step: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fillRect(-20, -30, 40, 30);
    ctx.fillRect(10, -50, 20, 20);
    ctx.fillStyle = "#fff";
    ctx.fillRect(24, -44, 4, 4);
    ctx.fillStyle = "#111";
    const legOffset = Math.sin(step / 5) > 0 ? 0 : 4;
    ctx.fillRect(-16, 0, 10, 10);
    ctx.fillRect(6 + legOffset, 0, 10, 10);
    ctx.restore();
  }

  return (
    <Card className="w-full overflow-hidden rounded-2xl border border-gray-200/70 shadow-[0_40px_120px_-60px_rgba(8,47,73,0.55)] dark:border-gray-800/70">
      <CardHeader className="flex flex-col gap-6 bg-gradient-to-br from-sky-100/70 via-white/80 to-transparent px-6 py-6 dark:from-sky-950/40 dark:via-gray-950/70 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3 text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-sky-600/90 shadow-sm backdrop-blur dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-300/90">
            RL Console
          </span>
          <CardTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Dino DQN Control Room
          </CardTitle>
          <CardDescription className="max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Launch autonomous runs, monitor telemetry, and stream frames while the agent learns the terrain.
            Built for future models and experiments.
          </CardDescription>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-[280px]">
          <div className="flex flex-col gap-2 text-left">
            <Label htmlFor="saveAt" className="text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
              Autosave threshold
            </Label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200/70 bg-white/80 px-3 py-2 text-sm shadow-sm backdrop-blur-sm dark:border-gray-800/70 dark:bg-gray-950/70">
              <Input
                id="saveAt"
                type="number"
                min={0}
                value={saveAt}
                onChange={(e) => setSaveAt(parseInt(e.target.value || "0", 10))}
                className="w-20 border-none bg-transparent p-0 text-right text-base font-semibold text-gray-900 focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-gray-50"
              />
              <span className="text-xs font-medium uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                obs
              </span>
            </div>
          </div>
          <Button
            onClick={start}
            disabled={running}
            className="h-11 rounded-xl text-sm font-semibold shadow-md transition-shadow hover:shadow-lg disabled:shadow-none"
          >
            {running ? "Training..." : "Launch Run"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 px-6 pb-6 pt-0">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Episode" value={episode.toLocaleString()} />
          <Metric label="Steps" value={steps.toLocaleString()} />
          <Metric label="Return" value={ret.toFixed(2)} />
          <Metric label="Best Score" value={best.toLocaleString()} />
        </div>
        <div className="flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Epsilon <span className="font-semibold text-gray-700 dark:text-gray-200">{epsilon.toFixed(2)}</span>
          </span>
          <span>Autosaving models when obstacles cleared ≥ {saveAt}</span>
          <span className="text-emerald-600 dark:text-emerald-400">{running ? "Agent running — streaming frames" : "Idle — launch a run to collect data"}</span>
        </div>
        {scores.length > 0 ? (
          <LearningGraph scores={scores} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300/70 bg-white/60 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700/70 dark:bg-gray-900/40 dark:text-gray-400">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500">No runs yet</span>
            <p>Kick off training to populate telemetry and chart progress here.</p>
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white/70 p-4 shadow-inner backdrop-blur dark:border-gray-800/70 dark:bg-gray-950/70">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(12,74,110,0.12),_transparent_65%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.1),_transparent_60%)]" aria-hidden="true" />
          <div className="relative flex justify-center">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Training visualization"
              className="max-w-full rounded-xl border border-gray-200/60 bg-transparent dark:border-gray-800/60"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white/75 px-4 py-3 text-left shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800/70 dark:bg-gray-950/70">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-50">{value}</div>
    </div>
  );
}

function LearningGraph({ scores }: { scores: number[] }) {
  const width = 800;
  const height = 120;
  const pad = 6;
  const n = scores.length;
  const max = Math.max(1, ...scores);
  const stepX = (width - pad * 2) / Math.max(1, n - 1);
  const pts = scores
    .map((s, i) => {
      const x = pad + i * stepX;
      const y = pad + (height - pad * 2) * (1 - s / max);
      return `${x},${y}`;
    })
    .join(" ");
  const last = scores[n - 1] ?? 0;
  const avg50 = avg(scores.slice(-50));
  const avg200 = avg(scores.slice(-200));
  return (
    <div className="w-full max-w-[800px]">
      <div className="flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500">
          Episode telemetry
        </span>
        <span className="space-x-2 text-[11px]">
          <span>Last {last}</span>
          <span>Avg50 {avg50.toFixed(1)}</span>
          <span>Avg200 {avg200.toFixed(1)}</span>
          <span>Max {max}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 w-full overflow-visible rounded-xl border border-gray-200/70 bg-white/70 p-3 text-sky-600 shadow-sm dark:border-gray-800/70 dark:bg-gray-950/70 dark:text-sky-300"
        role="img"
        aria-label="Episode scores over recent runs"
      >
        <defs>
          <linearGradient id="scoreLine" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#scoreLine)" strokeWidth={3} strokeLinecap="round" points={pts} />
      </svg>
    </div>
  );
}

function avg(a: number[]) {
  if (a.length === 0) return 0;
  return a.reduce((s, v) => s + v, 0) / a.length;
}

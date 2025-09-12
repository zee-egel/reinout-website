import React, { useEffect, useRef, useState } from "react";
import { DinoPhysics } from "../../physics/dino-physics";
import { buildObservationFromPhysics, OBS_SIZE } from "../../physics/env";
import { DQN } from "../../model/dqn";

type Status = "idle" | "loading" | "ready" | "playing" | "error";

export function AgentPlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const engineRef = useRef<DinoPhysics | null>(null);
  const agentRef = useRef<DQN | null>(null);
  const raf = useRef<number | null>(null);
  const time = useRef(0);

  useEffect(() => {
    engineRef.current = new DinoPhysics();
    setStatus("ready");
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  async function loadModel() {
    setStatus("loading");
    try {
      const agent = new DQN({ obsSize: OBS_SIZE, actionSize: 2 });
      await agent.load();
      agent.epsilon = 0;
      agentRef.current = agent;
      setStatus("ready");
      setMessage("Model loaded from IndexedDB");
    } catch (e) {
      setStatus("error");
      setMessage("Failed to load model. Train and save first.");
    }
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

  function startPlayback() {
    const canvas = canvasRef.current;
    const agent = agentRef.current;
    const engine = engineRef.current;
    if (!canvas || !agent || !engine) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas setup
    const scale = Math.min(1, Math.floor(window.devicePixelRatio || 1));
    canvas.width = engine.worldWidth * scale;
    canvas.height = engine.worldHeight * scale;
    canvas.style.width = engine.worldWidth + "px";
    canvas.style.height = engine.worldHeight + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);

    engine.reset();
    time.current = 0;
    setStatus("playing");

    let last = performance.now();
    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(50, now - last);
      last = now;
      time.current += dt / 16.6667;

      // Decide action
      const obs = buildObservationFromPhysics(engine);
      const actionIdx = agent.selectAction(obs);
      const jump = actionIdx === 1;
      const frames = dt / 16.6667;
      const res = engine.step({ jump }, frames);

      // Draw
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
      ctx.fillRect(0, 0, engine.worldWidth, engine.worldHeight);
      ctx.strokeStyle = getComputedStyle(document.body).color || "#111";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, engine.groundY + 10);
      ctx.lineTo(engine.worldWidth, engine.groundY + 10);
      ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle as string;
      for (const ob of engine.obstacles) {
        ctx.fillRect(ob.x, engine.groundY + 10 - ob.height, ob.width, ob.height);
      }
      drawDino(ctx, engine.dinoX, engine.dinoY, time.current);
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(engine.score).padStart(5, "0"), engine.worldWidth - 12, 24);

      if (res.done) {
        // Auto-restart immediately to keep playing continuously
        engine.reset();
      }
    };
    raf.current = requestAnimationFrame(loop);
  }

  return (
    <div className="max-w-[800px] w-full border rounded p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-semibold">Agent Playback</div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800" onClick={loadModel}>
            Load Latest Model
          </button>
          <button
            className="px-3 py-1 rounded bg-gray-900 text-white disabled:opacity-50 dark:bg-gray-100 dark:text-black"
            onClick={startPlayback}
            disabled={status === "loading" || !agentRef.current}
          >
            Watch Agent
          </button>
        </div>
      </div>
      {message && <div className="mt-2 text-xs text-gray-500">{message}</div>}
      <div className="mt-3 flex justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Agent playback canvas"
          className="border border-gray-300 dark:border-gray-800 rounded"
        />
      </div>
    </div>
  );
}

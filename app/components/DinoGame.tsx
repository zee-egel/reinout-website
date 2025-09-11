import { useEffect, useRef, useState } from "react";
import { DinoPhysics } from "../../physics/dino-physics";

type GameState = "ready" | "running" | "gameover";

export function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const engineRef = useRef<DinoPhysics | null>(null);
  const [high, setHigh] = useState<number>(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("dino-highscore")
        : null;
    return saved ? Number(saved) : 0;
  });

  const time = useRef(0);
  const raf = useRef<number | null>(null);
  const pressed = useRef<{ up: boolean; down: boolean }>({
    up: false,
    down: false,
  });

  function drawDino(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    step: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = ctx.strokeStyle as string;
    // body
    ctx.fillRect(-20, -30, 40, 30);
    // head
    ctx.fillRect(10, -50, 20, 20);
    // eye
    ctx.fillStyle = "#fff";
    ctx.fillRect(24, -44, 4, 4);
    ctx.fillStyle = "#111";
    // legs (alternate)
    const legOffset = Math.sin(step / 5) > 0 ? 0 : 4;
    ctx.fillRect(-16, 0, 10, 10);
    ctx.fillRect(6 + legOffset, 0, 10, 10);
    ctx.restore();
  }

  function resetGame() {
    engineRef.current?.reset();
    time.current = 0;
    setScore(0);
  }

  function start() {
    if (state === "running") return;
    resetGame();
    setState("running");
  }

  function gameOver() {
    setState("gameover");
    setHigh((prev) => {
      const best = Math.max(prev, engineRef.current?.score ?? 0);
      try {
        localStorage.setItem("dino-highscore", String(best));
      } catch {}
      return best;
    });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      pressed.current.up = true;
      if (state !== "running") start();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      pressed.current.down = true;
    } else if (e.code === "Enter" && state === "gameover") {
      e.preventDefault();
      start();
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      pressed.current.up = false;
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      pressed.current.down = false;
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    if (!engineRef.current) {
      engineRef.current = new DinoPhysics();
    }
    const engine = engineRef.current;

    function resize() {
      const scale = Math.min(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = engine.worldWidth * scale;
      canvas.height = engine.worldHeight * scale;
      canvas.style.width = engine.worldWidth + "px";
      canvas.style.height = engine.worldHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scale, scale);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let last = performance.now();

    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(50, now - last); // ms
      last = now;
      time.current += dt / 16.6667; // convert to ~frames

      // Clear
      ctx.fillStyle = getComputedStyle(document.body).color || "#111";
      const strokeColor = ctx.fillStyle;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
      ctx.fillRect(0, 0, engine.worldWidth, engine.worldHeight);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;

      // Ground line
      ctx.beginPath();
      ctx.moveTo(0, engine.groundY + 10);
      ctx.lineTo(engine.worldWidth, engine.groundY + 10);
      ctx.stroke();

      if (state === "running") {
        const frames = dt / 16.6667;
        const res = engine.step(
          { jump: pressed.current.up, duck: pressed.current.down },
          frames
        );
        setScore(res.score);
        if (res.done) {
          gameOver();
        }
      }

      // Draw obstacles
      ctx.fillStyle = strokeColor;
      for (const ob of engine.obstacles) {
        ctx.fillRect(
          ob.x,
          engine.groundY + 10 - ob.height,
          ob.width,
          ob.height
        );
      }

      // Draw dino
      drawDino(ctx, engine.dinoX, engine.dinoY, time.current);

      // UI
      ctx.fillStyle = strokeColor;
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        String(engine.score).padStart(5, "0"),
        engine.worldWidth - 12,
        24
      );
      if (high > 0) {
        ctx.fillText(
          `HI ${String(high).padStart(5, "0")}`,
          engine.worldWidth - 12,
          44
        );
      }

      ctx.textAlign = "center";
      if (state === "ready") {
        ctx.fillText(
          "Press Space to start",
          engine.worldWidth / 2,
          engine.worldHeight / 2
        );
      } else if (state === "gameover") {
        ctx.fillText(
          "Game Over — Press Enter",
          engine.worldWidth / 2,
          engine.worldHeight / 2
        );
      }
    };

    raf.current = requestAnimationFrame(loop);

    // Touch controls
    const onTap = (e: Event) => {
      e.preventDefault();
      if (state !== "running") start();
      else if (engine.dinoY >= engine.groundY) {
        // trigger a jump on next step
        pressed.current.up = true;
        // Clear immediately after to avoid continuous jumping
        setTimeout(() => (pressed.current.up = false), 0);
      }
    };
    canvas.addEventListener("pointerdown", onTap);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onTap);
    };
  }, [state]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Dino runner game canvas"
        className="border border-gray-300 dark:border-gray-800 rounded"
      />
      <div className="text-xs text-gray-500">
        Space to jump • Enter to restart • Tap on mobile
      </div>
    </div>
  );
}

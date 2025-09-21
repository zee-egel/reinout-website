import { useEffect, useRef, useState } from "react";
import { DinoPhysics } from "../../physics/dino-physics";

const LETTER_SEQUENCE = [
  { letter: "R", color: "#ff4d4d" },
  { letter: "E", color: "#ff8a00" },
  { letter: "I", color: "#ffd60a" },
  { letter: "N", color: "#2ec27e" },
  { letter: "O", color: "#339dff" },
  { letter: "U", color: "#7b4dff" },
  { letter: "T", color: "#d948e8" },
] as const;

const FLASH_DURATION = 1.4; // seconds
const ASSEMBLE_DURATION = 1.8;
const HOLD_DURATION = 1.2;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function withAlpha(hex: string, alpha: number) {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (/^#([0-9a-f]{6})$/i.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  return hex;
}

type GameState = "ready" | "running" | "gameover";

export function DinoGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<GameState>("ready");
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
  const letterProgressRef = useRef(0);
  const celebrationRef = useRef({ active: false, start: 0, finished: false });
  const exitOffsetRef = useRef(0);
  const themeRef = useRef<{ color: string; background: string }>({
    color: "#111111",
    background: "#ffffff",
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
    letterProgressRef.current = 0;
    celebrationRef.current = { active: false, start: 0, finished: false };
    exitOffsetRef.current = 0;
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
      engineRef.current = new DinoPhysics({ celebratoryRun: true });
    }
    const engine = engineRef.current;

    const updateTheme = () => {
      const styles = getComputedStyle(document.body);
      themeRef.current = {
        color: styles.color || "#111111",
        background: styles.backgroundColor || "#ffffff",
      };
    };

    function resize() {
      const scale = Math.min(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = engine.worldWidth * scale;
      canvas.height = engine.worldHeight * scale;
      canvas.style.width = engine.worldWidth + "px";
      canvas.style.height = engine.worldHeight + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(scale, scale);
      updateTheme();
    }

    resize();
    window.addEventListener("resize", resize);
    const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const handleMedia = () => updateTheme();
    if (media) {
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", handleMedia);
      } else if (typeof media.addListener === "function") {
        media.addListener(handleMedia);
      }
    }
    updateTheme();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let last = performance.now();

    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(50, now - last); // ms
      last = now;
      const frameStep = dt / 16.6667;
      time.current += frameStep; // convert to ~frames

      const themeColor = themeRef.current.color;
      const themeBg = themeRef.current.background;

      let stepResult: ReturnType<typeof engine.step> | null = null;
      const celebration = celebrationRef.current;
      const celebrationElapsed = celebration.active
        ? (now - celebration.start) / 1000
        : 0;
      let celebrationStage: "flash" | "assemble" | "hold" | "exit" | null = null;
      if (celebration.active && !celebration.finished) {
        if (celebrationElapsed < FLASH_DURATION) {
          celebrationStage = "flash";
        } else if (celebrationElapsed < FLASH_DURATION + ASSEMBLE_DURATION) {
          celebrationStage = "assemble";
        } else if (
          celebrationElapsed < FLASH_DURATION + ASSEMBLE_DURATION + HOLD_DURATION
        ) {
          celebrationStage = "hold";
        } else {
          celebrationStage = "exit";
        }
      }

      const shouldStep = !celebration.active || celebrationStage === "flash";

      if (state === "running" && shouldStep) {
        stepResult = engine.step(
          { jump: pressed.current.up, duck: pressed.current.down },
          frameStep
        );
        if (stepResult.done && !celebration.active) {
          gameOver();
        }
      }

      if (stepResult) {
        if (stepResult.letterSequenceProgress !== letterProgressRef.current) {
          letterProgressRef.current = stepResult.letterSequenceProgress;
        }
        if (stepResult.letterSequenceJustCompleted) {
          celebrationRef.current = { active: true, start: now, finished: false };
          exitOffsetRef.current = 0;
        }
      }

      if (celebrationStage === "exit") {
        exitOffsetRef.current += engine.speed * frameStep * 1.2;
        if (
          !celebration.finished &&
          engine.dinoX + exitOffsetRef.current - 20 > engine.worldWidth + 180
        ) {
          celebrationRef.current.finished = true;
          celebrationRef.current.active = false;
          gameOver();
        }
      }

      const textColor = celebrationStage
        ? "rgba(248,250,252,0.94)"
        : themeColor;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (celebrationStage === "flash") {
        const hue = (celebrationElapsed * 360 * 2) % 360;
        const gradient = ctx.createLinearGradient(
          0,
          0,
          engine.worldWidth,
          engine.worldHeight
        );
        gradient.addColorStop(0, `hsl(${hue}, 85%, 60%)`);
        gradient.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 85%, 55%)`);
        gradient.addColorStop(1, `hsl(${(hue + 240) % 360}, 85%, 58%)`);
        ctx.fillStyle = gradient;
      } else if (
        celebrationStage === "assemble" ||
        celebrationStage === "hold" ||
        celebrationStage === "exit"
      ) {
        const assembleProgress = Math.min(
          1,
          Math.max(0, (celebrationElapsed - FLASH_DURATION) / ASSEMBLE_DURATION)
        );
        const eased = easeInOutCubic(assembleProgress);
        const gradient = ctx.createRadialGradient(
          engine.worldWidth / 2,
          engine.worldHeight / 2,
          20,
          engine.worldWidth / 2,
          engine.worldHeight / 2,
          engine.worldWidth
        );
        gradient.addColorStop(0, `rgba(12, 18, 44, ${0.6 + 0.3 * eased})`);
        gradient.addColorStop(1, "rgba(2, 4, 20, 0.95)");
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = themeBg;
      }
      ctx.fillRect(0, 0, engine.worldWidth, engine.worldHeight);

      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;

      ctx.save();
      ctx.globalAlpha = celebrationStage ? 0.7 : 1;
      ctx.beginPath();
      ctx.moveTo(0, engine.groundY + 10);
      ctx.lineTo(engine.worldWidth, engine.groundY + 10);
      ctx.stroke();
      ctx.restore();

      if (!celebrationStage || celebrationStage === "flash") {
        for (const ob of engine.obstacles) {
          if (ob.kind === "letter" && ob.letter) {
            const fill = ob.color ?? textColor;
            ctx.save();
            ctx.font = "bold 60px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillStyle = fill;
            ctx.shadowColor = withAlpha(fill, 0.35);
            ctx.shadowBlur = 14;
            ctx.fillText(ob.letter, ob.x + ob.width / 2, engine.groundY + 6);
            ctx.restore();
          } else {
            ctx.fillStyle = textColor;
            ctx.fillRect(
              ob.x,
              engine.groundY + 10 - ob.height,
              ob.width,
              ob.height
            );
          }
        }
      }

      if (
        celebrationStage === "assemble" ||
        celebrationStage === "hold" ||
        celebrationStage === "exit"
      ) {
        const assembleProgress =
          celebrationStage === "assemble"
            ? Math.min(
                1,
                (celebrationElapsed - FLASH_DURATION) / ASSEMBLE_DURATION
              )
            : 1;
        const eased = easeInOutCubic(Math.max(0, assembleProgress));
        const exitFade =
          celebrationStage === "exit"
            ? Math.max(
                0,
                1 -
                  Math.min(
                    1,
                    (celebrationElapsed -
                      FLASH_DURATION -
                      ASSEMBLE_DURATION -
                      HOLD_DURATION) /
                      1.1
                  )
              )
            : 1;
        const spacing = 64;
        const baseY = engine.groundY - 16;
        const targetY = engine.worldHeight / 2;
        const totalWidth = (LETTER_SEQUENCE.length - 1) * spacing;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 68px Inter, sans-serif";
        LETTER_SEQUENCE.forEach((entry, index) => {
          const startX =
            engine.worldWidth * ((index + 1) / (LETTER_SEQUENCE.length + 1));
          const targetX =
            engine.worldWidth / 2 - totalWidth / 2 + index * spacing;
          const x = lerp(startX, targetX, eased);
          const y = lerp(baseY, targetY, eased);
          const color = withAlpha(entry.color, Math.pow(exitFade, 0.9));
          ctx.shadowColor = withAlpha(entry.color, 0.35 * exitFade);
          ctx.shadowBlur = 24 * eased;
          ctx.fillStyle = color;
          ctx.fillText(entry.letter, x, y);
        });
        ctx.restore();
      }

      const dinoOffsetX =
        celebrationStage === "exit" ? exitOffsetRef.current : 0;
      drawDino(ctx, engine.dinoX + dinoOffsetX, engine.dinoY, time.current);

      ctx.fillStyle = textColor;
      ctx.font = "bold 16px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.globalAlpha = celebrationStage && celebrationStage !== "flash" ? 0.82 : 1;
      ctx.fillText(String(engine.score).padStart(5, "0"), engine.worldWidth - 12, 24);
      if (high > 0) {
        ctx.fillText(`HI ${String(high).padStart(5, "0")}`, engine.worldWidth - 12, 44);
      }
      ctx.globalAlpha = 1;

      if (!celebrationStage) {
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
      if (media) {
        if (typeof media.removeEventListener === "function") {
          media.removeEventListener("change", handleMedia);
        } else if (typeof media.removeListener === "function") {
          media.removeListener(handleMedia);
        }
      }
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

export type Obstacle = { x: number; width: number; height: number; passed?: boolean };

export type StepInput = {
  jump?: boolean;
  duck?: boolean;
};

export type StepResult = {
  done: boolean;
  score: number;
  speed: number;
  dinoY: number;
  obstacles: ReadonlyArray<Obstacle>;
  obstaclesCleared: number;
};

export class DinoPhysics {
  // World constants
  readonly worldWidth = 800;
  readonly worldHeight = 200;
  readonly groundY = 160;
  readonly dinoX = 80;
  readonly gravity = 0.9; // px/frame^2
  readonly jumpVelocity = -14; // px/frame
  readonly baseSpeed = 6; // px/frame

  // Mutable state
  private velY = 0;
  private _dinoY = this.groundY;
  private _speed = this.baseSpeed;
  private _obstacles: Obstacle[] = [];
  private spawnCooldown = 0; // frames
  private scoreInt = 0;
  private scoreAcc = 0; // fractional accumulator
  private _obstaclesCleared = 0;

  // Internal time (frames)
  private t = 0;

  get dinoY() {
    return this._dinoY;
  }
  get speed() {
    return this._speed;
  }
  get obstacles(): ReadonlyArray<Obstacle> {
    return this._obstacles;
  }
  get score() {
    return this.scoreInt;
  }
  get obstaclesCleared() {
    return this._obstaclesCleared;
  }

  reset() {
    this.velY = 0;
    this._dinoY = this.groundY;
    this._speed = this.baseSpeed;
    this._obstacles = [];
    this.spawnCooldown = 30;
    this.scoreInt = 0;
    this.scoreAcc = 0;
    this.t = 0;
    this._obstaclesCleared = 0;
  }

  // Advance by `frames` (can be fractional). Returns whether episode ended and snapshot.
  step(input: StepInput = {}, frames = 1): StepResult {
    const f = Math.max(0, frames);
    this.t += f;

    // Difficulty increase with score
    this._speed = this.baseSpeed + Math.min(8, this.scoreInt / 150);

    // Jump
    if (input.jump && this._dinoY >= this.groundY) {
      this.velY = this.jumpVelocity;
    }

    // Vertical physics
    this.velY += this.gravity * f;
    this._dinoY = Math.min(this.groundY, this._dinoY + this.velY * f);
    if (this._dinoY === this.groundY) this.velY = 0;

    // Spawn obstacles
    this.spawnCooldown -= f;
    if (this.spawnCooldown <= 0) {
      const height = 20 + Math.floor(Math.random() * 30); // 20–50
      const width = 10 + Math.floor(Math.random() * 20); // 10–30
      this._obstacles.push({ x: this.worldWidth + 20, width, height });
      this.spawnCooldown = 60 + Math.random() * 40; // frames
    }

    // Move obstacles and cull off-screen
    for (const ob of this._obstacles) {
      ob.x -= this._speed * f;
      if (!ob.passed && ob.x + ob.width < this.dinoX) {
        ob.passed = true;
        this._obstaclesCleared += 1;
      }
    }
    while (
      this._obstacles.length &&
      this._obstacles[0].x + this._obstacles[0].width < 0
    ) {
      this._obstacles.shift();
    }

    // Collision check
    const dinoBox = { x: this.dinoX - 20, y: this._dinoY - 30, w: 40, h: 40 };
    let done = false;
    for (const ob of this._obstacles) {
      const obBox = {
        x: ob.x,
        y: this.groundY + 10 - ob.height,
        w: ob.width,
        h: ob.height,
      };
      const hit =
        dinoBox.x < obBox.x + obBox.w &&
        dinoBox.x + dinoBox.w > obBox.x &&
        dinoBox.y < obBox.y + obBox.h &&
        dinoBox.y + dinoBox.h > obBox.y;
      if (hit) {
        done = true;
        break;
      }
    }

    // Score by distance (scaled by speed)
    this.scoreAcc += (this._speed / 6) * f;
    if (this.scoreAcc >= 1) {
      const inc = Math.floor(this.scoreAcc);
      this.scoreInt += inc;
      this.scoreAcc -= inc;
    }

    return {
      done,
      score: this.scoreInt,
      speed: this._speed,
      dinoY: this._dinoY,
      obstacles: this._obstacles,
      obstaclesCleared: this._obstaclesCleared,
    };
  }
}

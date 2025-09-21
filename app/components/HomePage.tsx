import { DinoGame } from "./DinoGame";
import { RLControls } from "./RLControls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function Homepage() {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-white to-white dark:from-gray-950 dark:via-gray-950 dark:to-black">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-12 sm:px-6 lg:px-10">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-500 dark:text-gray-400">
            Reinout&apos;s Playground
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl">
            Desert Runs & Learning Machines
          </h1>
          <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-300 sm:text-base">
            Explore a growing collection of interactive experiments. Start by outrunning the chrome dino, then
            switch tabs to watch a reinforcement learning agent hustle for the high score.
          </p>
        </header>

        <Tabs defaultValue="play" className="mt-10 flex-1">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <TabsList className="w-full max-w-xl">
              <TabsTrigger value="play">Arcade</TabsTrigger>
              <TabsTrigger value="train">RL Lab</TabsTrigger>
              <TabsTrigger value="projects">Projects Deck</TabsTrigger>
            </TabsList>
            <span className="text-xs uppercase tracking-[0.32em] text-gray-400 dark:text-gray-600">
              Swipe between worlds
            </span>
          </div>

          <TabsContent value="play" className="flex flex-col">
            <section className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white/85 px-6 py-12 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/60">
              <div className="absolute -left-14 top-24 h-44 w-44 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-500/20" aria-hidden="true" />
              <div className="absolute -right-10 top-[-5rem] h-64 w-64 rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-500/20" aria-hidden="true" />
              <div className="absolute inset-x-10 bottom-10 h-px bg-gradient-to-r from-transparent via-gray-300/60 to-transparent dark:via-gray-700/60" aria-hidden="true" />

              <div className="relative z-10 mx-auto grid max-w-[min(100%,_1200px)] items-center gap-10 text-center lg:grid-cols-[1.05fr_minmax(0,1fr)] lg:text-left">
                <div className="flex flex-col items-center gap-6 lg:items-start">
                  <span className="rounded-full border border-gray-300/70 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.45em] text-gray-500 shadow-sm backdrop-blur dark:border-gray-700/70 dark:bg-gray-900/70 dark:text-gray-300">
                    Play Mode
                  </span>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-50 sm:text-4xl">
                      Take the Dino for a Midnight Run
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 sm:text-base">
                      The arcade is tuned for flow—tap space to leap, arrow down to duck, and chase a new high score.
                      Lighting adjusts with your theme so the midnight desert always feels alive.
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 sm:flex-row">
                    <span>Space · Jump</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Arrow ↓ · Duck</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Highscore persists locally</span>
                  </div>
                </div>

                <div className="relative flex w-full flex-col items-center gap-6">
                  <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-blue-200/30 blur-3xl dark:bg-blue-400/20" aria-hidden="true" />
                  <div className="relative w-full max-w-[min(100%,_1360px)]">
                    <div className="absolute inset-0 translate-y-8 rounded-[32px] bg-gradient-to-r from-slate-900/10 to-transparent blur-3xl dark:from-slate-900/35" aria-hidden="true" />
                    <div className="relative overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.35),_rgba(241,245,249,0.78))] p-5 shadow-[0_25px_80px_-45px_rgba(15,23,42,0.85)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,_rgba(15,23,42,0.78),_rgba(30,41,59,0.68))]">
                      <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-slate-50/85 shadow-inner dark:border-slate-700/70 dark:bg-slate-900/75">
                        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.24),_transparent_70%)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_65%)]" aria-hidden="true" />
                        <div className="relative z-10 flex w-full justify-center p-4 sm:p-8 lg:p-10">
                          <DinoGame />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:gap-4">
                    <span className="rounded-full border border-gray-300/60 bg-white/80 px-4 py-1 font-medium tracking-[0.24em] dark:border-gray-700/60 dark:bg-gray-900/70">
                      Live reflex meter
                    </span>
                    <span>Game speed tracks your personal bests in real time.</span>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="train" className="flex flex-col gap-8">
            <section className="rounded-3xl border border-gray-200/80 bg-white/80 px-6 py-10 shadow-[0_32px_120px_-70px_rgba(59,130,246,0.6)] backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/60">
              <div className="flex flex-col gap-4 text-center sm:text-left">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-500 dark:text-emerald-400">
                  Reinforcement Lab
                </span>
                <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-50 sm:text-4xl">
                  Watch the Agent Learn in Real Time
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 sm:text-base">
                  Tune parameters, stream frames, and monitor returns as the DQN sharpens its reflexes. Built to
                  grow with future experiments and model showcases.
                </p>
              </div>
              <div className="mt-8 flex justify-center">
                <div className="w-full max-w-5xl">
                  <RLControls />
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="projects" className="flex flex-col">
            <section className="relative overflow-hidden rounded-3xl border border-dashed border-gray-300/70 bg-white/60 px-6 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-xl dark:border-gray-700/70 dark:bg-gray-950/40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.12),_transparent_60%)]" aria-hidden="true" />
              <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                <span className="rounded-full border border-purple-300/60 px-5 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-purple-500/90 dark:border-purple-600/60 dark:text-purple-300/90">
                  Coming Soon
                </span>
                <h2 className="text-3xl font-semibold text-gray-900 dark:text-gray-50 sm:text-4xl">
                  Portfolio Worlds Loading
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 sm:text-base">
                  Each project will get its own interactive tab—games, ML experiments, visualisations, and more.
                  This tab layout is primed for expansion, so we can slot in new showcases as they ship.
                </p>
                <p className="text-xs uppercase tracking-[0.28em] text-gray-400 dark:text-gray-500">
                  Drop your next idea here ↓
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

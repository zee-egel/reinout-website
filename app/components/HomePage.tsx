import { DinoGame } from "./DinoGame";
import { RLControls } from "./RLControls";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function Homepage() {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-white to-white dark:from-gray-950 dark:via-gray-950 dark:to-black">
      <div className="mx-auto max-w-[1000px] px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Dino Runner</h1>
          <p className="text-sm text-gray-500">Play and train an agent to master the offline classic.</p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Game</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <DinoGame />
              </div>
            </CardContent>
          </Card>
          <RLControls />
        </div>
      </div>
    </main>
  );
}

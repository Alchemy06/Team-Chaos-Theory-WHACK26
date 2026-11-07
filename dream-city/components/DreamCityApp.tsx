// The app: a client-only voxel world (components/world) with a conventional
// HUD layered on top (components/hud). Data and logic come from lib/ and the
// API routes; shared state lives in store/.

import { HudShell } from "./hud/HudShell";
import { WorldLoader } from "./world/WorldLoader";

export default function DreamCityApp() {
  return (
    <main className="night-sky relative h-dvh w-full overflow-hidden">
      <WorldLoader />
      <HudShell />
    </main>
  );
}

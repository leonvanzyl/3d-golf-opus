# Adventure Mini Golf

A 3D adventure mini golf game that runs in the browser. It's built with **Vite + Three.js**, and everything in it is generated in code: models, textures, shaders and sounds. There are no external asset files and no backend, and your best scores are saved in `localStorage`.

## Run it locally

You need Node.js 18 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

To build and preview the production bundle:

```bash
npm run build     # creates the static dist/ folder
npm run preview   # serves dist/ on http://localhost:4173
```

## Deploy to Vercel

The project is a plain static Vite site, so Vercel needs no configuration.

- **From the dashboard:** push the folder to a Git repository, then click **Add New… → Project** on vercel.com and import it. Vercel detects Vite, runs `npm run build` and serves `dist/`. Click **Deploy**.
- **From the CLI:** run `npx vercel` in the project folder (use `npx vercel --prod` for a production deploy) and accept the defaults.

You don't need any environment variables, serverless functions or storage.

## How to play

| Action | Control |
| --- | --- |
| Aim | Move the mouse (or A/D or ←/→; hold Shift for fine aim) |
| Putt | Click and hold, drag the mouse **back** to set power, then release. Drag forward again or right-click to cancel. You can also hold Space to charge a putt. |
| Zoom / overview | Mouse wheel zooms. **V** switches to an overview camera of the whole hole. |
| Restart hole | **R** or the ↻ button |
| Mute | **M** or the speaker button |
| Pause | **Esc** / **P** or the ❚❚ button |
| Skip flyover | Click or press Space |

The first click in a hole locks the mouse pointer so you can aim freely. Press **Esc** to get the cursor back; this also opens the pause menu.

**Switching holes:** choose **Choose a Hole** on the main menu to play any single hole, or pause mid-game and pick **Jump to Hole…**. During a full round, jumping keeps your scorecard. The next-hole button always takes you to the next hole you haven't played yet, and the round ends once all nine are scored.

**Rules:**
- Water, lava and out of bounds each cost one stroke, and the ball goes back to where you played it from.
- Each hole is capped at 10 strokes.
- If the ball comes to rest on top of a wall, it's an unplayable lie: it goes back to where you played it from, with no penalty.
- Scoring a hole-in-one or finishing under par triggers a celebration.
- A scorecard appears after every hole, and a final scorecard at the end of the round.
- Your best round and your best score on each hole are stored in the browser.

## The nine holes

| # | Hole | Par | Signature challenge |
| - | --- | - | --- |
| 1 | Sunny Meadow | 2 | Warm-up over a grassy hump and a plank bridge across a brook |
| 2 | Windmill Farm | 3 | Putt through the windmill door between the spinning sails, then drop down a ramp to the green |
| 3 | Pirate Cove | 3 | Split path: a narrow plank with no rails across the lagoon, or the long boardwalk around it |
| 4 | Carnival Pinball | 3 | A tilted pinball table with pop bumpers (one of them moves) and slingshot kickers |
| 5 | Frosty Peaks | 3 | Slippery ice slalom around snowmen, a banked hairpin and a glittering ice cave |
| 6 | Jurassic Jungle | 4 | Putt between a T-Rex's feet while its tail sweeps the clearing. There's a river on the open side, then a ramp up to its nest. |
| 7 | Clockwork Factory | 4 | A sideways conveyor, an uphill lift belt, a spinning gear turntable and punching pistons |
| 8 | Cosmic Portal | 4 | A loop-the-loop and a jump across the void, or a narrow bridge past a sliding block into a portal |
| 9 | Volcano Summit | 5 | Tilted stone rafts sliding over a lava river, then a jump over a lava pit (or the long way round) |

Every hole has its own ambient life: butterflies, bunnies, chickens, sheep, crabs, fish, seagulls, a bobbing pirate ship that fires its cannons, penguins, a roaring dinosaur, pterodactyls, robots, spinning gears, a UFO, an erupting volcano, waterfalls, flickering torches and more.

## Under the hood

- **Physics** (`src/physics/Physics.js`): a custom sphere-vs-world solver that runs in fixed 1/480 s sub-steps.
  - Each step moves the ball less than its radius, so it can never tunnel through walls.
  - Static geometry is a triangle grid. Moving obstacles are analytic boxes, cylinders and capsules driven by the same clock as their visuals.
  - It models rolling resistance, slopes (at 5/7 g for a rolling ball), bounces, moving surfaces (conveyors, rafts, turntables), portals, and real cup capture with lip-outs.
- **Course builder** (`src/course/Builder.js`): each helper (floors, walls, swept tracks, loops, ramps, water, lava) creates the visual mesh and its collider together. Static meshes are merged per material to keep draw calls low.
- **Rendering:**
  - Toon (cel) materials with inverted-hull outlines, plus a rim light.
  - Custom GLSL for the sky (clouds, stars, aurora, nebula), water, lava, falls, swaying grass, portals and flames.
  - Post-processing: MSAA, bloom and tone mapping.
  - Adaptive quality: resolution and bloom step down automatically if the frame rate drops.
- **Audio** (`src/audio/Audio.js`): Web Audio synthesis for putts, wall hits by material, rolling, cup rattles, splashes, sizzles, bumpers, portals, the dinosaur's roar, fanfares and per-hole ambience.

## Checking that every hole can be completed

```bash
npm run verify
```

This runs the real game physics headlessly in Node. A beam search tries putt directions, powers and timings until each hole is holed, and the command fails if any hole can't be completed. It also checks that no terrain intersects the playable surfaces. `node tools/probe.mjs <hole> <yawDeg> <speeds> [x,y,z] [wait]` tests individual shots.

## Project layout

```
index.html            UI overlay markup
src/main.js           entry point
src/game/             game state machine, camera rig, storage
src/physics/          ball physics
src/course/           course builder, props, scenery helpers
src/holes/            the nine holes (hole1.js … hole9.js)
src/engine/           renderer, toon materials, GLSL shaders
src/audio/            synthesised sound
src/fx/               particle effects
src/ui/               DOM UI + styles
tools/                headless verification scripts
```

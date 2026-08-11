# Streetlevel — working notes

A plain-English NYC subway navigator for tourists. It replaces map navigation
with sequential physical instructions: which staircase, which train car, which
train *not* to board, what to do when lost. Offline-first — a trip compiles to
a self-contained "Transit Packet" that works with no signal underground.

This file is context for whoever picks the project up next, human or agent.
It is the things that are not obvious from reading the code.

## Run it in the iOS Simulator

The desktop app's simulator pane works in **local sessions only** — a cloud or
SSH session cannot reach the simulators on your Mac. Needs **Xcode 26.x**; the
pane does not work with Xcode 27 (`xcode-select -p` to check).

```bash
npm install
npm run build                        # workspace packages the app imports
npm start --workspace=streetlevel-mobile -- --ios
```

No prebuild: every native dep is an `expo-*` module inside Expo Go, and there
is no `ios/` directory. Fast Refresh works normally.

## Verify

```bash
npm run typecheck    # includes tests — see the note below, this matters
npm test             # 252 tests
npm run screenshot   # renders the real screens to tools/screenshot/generated/
npm run map          # rebuilds tools/map/generated/map.html from the graph
```

`npm run screenshot` is the main way to see the UI without a device. It runs the
actual shipped components under react-native-web in Chromium against real
compiled packets — not mock copy. **Look at the output.** Every UI bug in this
project's history was caught by looking at a frame, and none were caught by
reading the code.

## Layout

| Package | What it owns |
|---|---|
| `packages/shared` | The wire contract, the theme, validation, the stop detector |
| `packages/data` | GTFS import, the station graph, connectors, pathways, geocoding |
| `packages/router` | Dijkstra over (station, line), trip planning |
| `packages/shaper` | Compiles a route into cards. **The source of truth for what a card says.** |
| `server` | The API, quota metering, the 402 paywall |
| `mobile` | Expo client |
| `tools/` | Screenshot harness, interactive map, icons, design studies |

`packages/data/generated/network.json` is a build artefact, committed. Rebuild
with `npm run fetch:gtfs && npm run build:dataset --workspace=@streetlevel/data`.

## Invariants that cost something to learn

Break these and the product lies to somebody standing in a station.

**The shaper authors every fact.** Station names, line ids, stop counts, car
positions all come from the compiler. The optional language-model pass may only
rewrite prose — `isSafeRewrite` rejects anything that changes a fact. A model
that invents a station name strands a person.

**Never claim what has not been surveyed.** Unsurveyed entrances say so rather
than naming a corner. `isQuotable` is the gate. A tourist walked to a
confidently-named corner with no staircase is worse off than one told to look
for any entrance sign.

**No compass directions.** Nobody underground knows which way is north.
`containsCompassDirection` enforces it.

**`criticalAvoidanceNotes` is for genuine prohibitions only.** It renders under
a DO NOT heading. Caveats and instructions there read as alarms and get
obeyed as prohibitions — that bug shipped once already.

**Colour is not a line.** 1/2/3 are all red. Copy that says "look for the red
train" fails inside a trunk; fall back to the number. See
`dimmedLinesSentence`.

**Service periods are load-bearing.** The graph carries per-edge trip counts for
WEEKDAY / WEEKEND / LATE_NIGHT. Ignore them and you route somebody onto a 4
train at 33 St at lunchtime, where it does not stop.

**A complex is one station.** Times Square is five records at one corner. The
router, the map and the cards all treat a complex as one place; a route still
points at a specific platform, because that is what the traveller must find.

**Connectors are not trains.** The Roosevelt Island Tramway is in the fare
network but not the subway feed. It routes, but a card about it carries
`connectorFocus` and never a `targetLineFocus` — without that it inherits the
previous train's colour and bullet and tells somebody to look for a W on the
way to a cable car. `includedInSubwayFare` gates routing, because the AirTrain
and NYC Ferry cost extra and must never be silently routed through.

**The stop detector gets no count it cannot verify.** Its model is tunnel signal
loss and station-to-station timing. Do not hand it `offlineSensorValidation`
for anything above ground.

## A trap worth knowing about

Package tsconfigs exclude `*.test.ts` so tests stay out of `dist/`. For most of
this project's life that meant **nothing typechecked the tests at all**, and a
routing test passed while feeding `planRoute` an alert with invented field
names — the resolver ignored it, so the test asserted against a route with no
disruption applied. `tsconfig.test.json` closes this and runs as part of
`npm run typecheck`. There may be other vacuous assertions from that era.

## State of things

**Verified:** the full pipeline compiles real packets; 252 tests; strict
typecheck across workspace and tests; the offline SQLite seed against a real
SQLite engine; Metro bundles for iOS (672 modules → 1.4 MB Hermes) and Android
(1.7 MB); every screen renders under react-native-web.

**Never run:** anything on a real or simulated device. No fonts, haptics,
`expo-sqlite` against a real file, or camera permissions have been exercised.
That is the single biggest unknown and the reason to get it into a simulator.

**Known weak spots:** `#7C858C` (L, S) with white ink measures 3.7:1. The map's
line legend overlaps station labels near it. Micro-navigation records
(entrances, car positions, exit alignments) are sample data, not surveys —
`provenance` marks them and the copy admits it.

`ROADMAP.md` has the longer-range thinking: car position, offline sensing,
camera recovery, proficiency levels, data sourcing and licensing, and the
competitive read on Mapway's app.

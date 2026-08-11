# Streetlevel

**Plain-English NYC subway navigation for people who have never used it.**

Not a map. A deck of cards, one physical action each, that you generate above
ground and follow underground with no signal:

> **Wait here for the 3 train toward New Lots Av** (heading into Brooklyn)
> · The front of the train reads "New Lots Av".
> · The 1 and 2 stop here too and are the same red as yours. Do not go by colour
>   on this platform — read the number on the front of the train.
> ⚠ Do not board the first train that arrives unless its front sign reads "New Lots Av".

The premise is that tourists do not get lost because they lack a map. They get
lost in the last thirty metres — wrong staircase, wrong platform, wrong
direction, wrong exit — and a 2D map is silent on every one of those.

![Six screens of the Streetlevel client](tools/screenshot/generated/screens.png)

Those are the real screen components rendered through react-native-web against a
real compiled packet — `npm run screenshot` regenerates them. Not a native
build: metrics and font rendering on a device will differ. It is still the
fastest way to see what the app *says* before anyone has it on a phone, and it
has already earned its keep — the first run showed the entrance screen drawing a
confident four-corner diagram for a station nobody has surveyed, which is
precisely the mistake that screen exists to prevent.

---

## What is real here, and what is not

This repo takes the honesty conventions of the rest of `TheOpenWildThingz`
seriously, so before anything else:

| Layer | Status |
|---|---|
| Station graph, travel times, transfers, express skip-stops | **Real.** Built from the MTA's own GTFS static feed (`20260807-H-rockaways-extension-removed`, valid 2026‑05‑26 → 2026‑10‑31). 475 stations, 423 complexes, 1,890 track edges, 613 transfers. |
| Routing, service periods, alert diversion | **Real and tested.** Dijkstra over `(station, line)` state with per-period service filtering. |
| Plain-English card compilation | **Real and tested.** Deterministic; every fact traceable to the feed. |
| On-device SQLite schema + seed | **Real and verified**, executed against a live SQLite engine with constraints asserted. |
| Freemium metering, 402 lifecycle | **Real and tested**, Postgres-backed. |
| Expo client | **Real code, typechecked, pure logic unit-tested.** Never run on a device or simulator — there is no mobile runtime in this build environment. |
| **Micro-navigation survey data** (entrance corners, landmark cues, exit car alignment) | **Sample only.** See below. This is the honest gap. |
| Nvidia NIM prose pass | **Real client, guarded and tested against a fake.** Never run against actual NIM hardware. |
| Live service-alert ingestion | **Provider seam only.** The MTA's realtime endpoint is not reachable from this environment; the GTFS‑Realtime→`ServiceAlert` adapter is deliberately not written. |
| Docker image | **Not built.** The Docker CLI exists here but there is no daemon. |

### The micro-navigation gap, stated plainly

The product's whole pitch is knowing *which staircase*. That data does not
exist in any public feed — GTFS knows a station has platforms; it does not know
that the passage to the uptown platform is behind you as you come off the
escalator. It only comes from a person standing in the station writing it down.

So `packages/data/src/micronav.ts` ships a **schema, a lookup layer, and five
sample entrances**, every record stamped `SAMPLE_UNVERIFIED`. The compiler
refuses to quote unverified prose as an instruction:

```ts
export function isQuotable(record: { provenance: Provenance }): boolean {
  return record.provenance === 'FIELD_SURVEYED';
}
```

Unsurveyed stations get instructions that stay true regardless — "look for a
staircase with a green globe and a sign reading *Times Sq-42 St*; the sign will
list the 1, 2, 3 trains" — plus an explicit note that the individual staircases
here have not been surveyed. **A tourist sent to a confidently-named corner
with no staircase on it is worse off than one told to read the signs.**

Field survey is the actual work of shipping this product. The engine is done;
the walking is not.

---

## What it does that a mapping app does not

**It tells you which train is *not* yours.** Co-located lines are never hidden —
a traveller who watches a train pull in that their app never mentioned assumes
the app is broken. They are named, dimmed to 25% opacity, and explicitly
dismissed.

**And it knows when its own colour system is a trap.** Colour coding is the
product's central cognitive shortcut, right up until the platform where it
fails: the 1, 2 and 3 are all red, the N, Q, R and W all yellow. At Times Square
"wait for the red train" is the single worst instruction this app could give. So
when a dimmed line shares the target's colour, the copy drops colour entirely and
falls back to the only thing that differs on the front of the train:

> Your train is the 3. Check the number, not the colour — the others here are
> the same colour.

**It gives you a wrong-direction check you can verify in 90 seconds.** Every
on-train card names the station you would see first if you boarded the opposite
way, computed from the reversed edge on the same line:

> If the first station you see is 72 St, you are going the wrong way. Get off
> there, cross to the opposite platform, and start this card again.

**It knows what an express train flies past.** 104 hops carry the stations they
skip, derived by matching each express hop against the local line sharing its
trunk. That is the reassurance beat right after the doors close.

**It warns you that the way home is different, before you leave.** The
divergence engine compiles both legs and diffs them. Real output for Times
Square → Brooklyn Botanic Garden with a 1:30am return:

> Do not assume your way home is your way out reversed. Your route home is not
> the reverse of your route out: you will not be using the 3 on the way back, and
> your return uses the Q instead. You come home from a different station than the
> one you arrive at. Your return falls in the overnight timetable, when several
> lines run differently.

**It tells you to walk when walking is better.** Times Square → Morgan Library
returns `WALK_INSTEAD: that is about a 14 minute walk — faster than going
underground`, and does not spend one of your free credits.

---

## The bug that shaped the routing engine

An early build cheerfully put a 2pm traveller on a **4** train at 33 St. The 4
does not stop at 33 St — except overnight, when it drops onto the local track.
The graph was time-agnostic, so a late-night-only edge was available at lunchtime.

The fix is that every edge carries its scheduled trip counts per service period:

```ts
export interface ServiceCounts { weekday: number; weekend: number; lateNight: number }
```

and the router only traverses an edge with at least four scheduled trips in the
period being planned for. One or two trips is a put-in run, not service you can
stand on a platform and wait for. The same fix corrected every headsign in the
system, because a hop's direction and front-sign text now come from the trips
that actually make it rather than from the line in general.

`packages/router/src/route.test.ts` pins this:

```ts
it('keeps the 4 train off 33 St during the day', () => { … })
```

---

## Where the language model is allowed to touch anything

Nowhere structural. The deterministic compiler produces the entire packet from
schedule data; the model may only rewrite prose, and every rewrite must survive
`isSafeRewrite`:

- every `**bolded**` span (station names, line bullets) preserved exactly
- every integer preserved — stop counts and car positions are load-bearing
- no compass direction introduced that was not already there
- same number of visual anchors
- no more than 2.5× the original length

Anything that fails keeps the compiled text. For the "I Messed Up" flow the
inversion is the safety property: **a deterministic ranker builds the shortlist,
and the model may only choose from it.** It cannot name a station that does not
exist, and a station off the list is rejected outright.

Below `RECOVERY_CONFIDENCE_FLOOR` (0.45) the system refuses to route at all and
asks a clarifying question instead. "23" alone names four different stations on
four different lines; confidence is derived from the *margin* between the best
and second-best candidate, so a tie reads as ignorance rather than a coin flip.
Station-name tokens are IDF-weighted against the station list — "Bedford"
appears in three names and nearly identifies a station; "St" appears in most of
the system and means nothing.

The recovery endpoint is **deliberately not metered**. Someone lost underground
is the worst possible person to show a paywall to.

---

## Layout

```
streetlevel/
├── packages/
│   ├── shared/     the wire contract: TransitPacket types, runtime validators,
│   │               MTA line colours (from the feed's own route_color), theme tokens
│   ├── data/       GTFS importer → station graph; borough polygons; geocoder seam;
│   │               the micro-navigation survey layer; SQLite seed emitter
│   ├── router/     Dijkstra over (station, line) with transfer penalties,
│   │               service periods, and alert diversion
│   └── shaper/     the card compiler, the divergence engine, the NIM gateway,
│                   the recovery resolver
├── server/         Fastify API: packet compilation, recovery, device-bound metering
├── mobile/         Expo client: card deck, entrance lock, paywall, offline store
└── Dockerfile, docker-compose.yml
```

Types flow one way and break loudly: `packages/shared` is imported by the server
*and* the Expo client, so a change to the payload shape is a compile error on the
phone rather than a crash sixty feet underground.

---

## Running it

```bash
npm install

# Rebuild the station graph from the live MTA feed (optional — the compiled
# graph is committed, and records which feed version it came from).
npm run fetch:gtfs    --workspace=@streetlevel/data
npm run build:dataset --workspace=@streetlevel/data

npm run build
npm test                                        # 181 tests
npm run verify:sqlite --workspace=@streetlevel/data   # real SQLite engine

npm run server:dev    # http://localhost:8080
```

```bash
curl -s localhost:8080/v1/packets \
  -H 'content-type: application/json' -H 'x-device-id: demo-device-1' \
  -d '{"originAddress":"Times Square","destinationAddress":"Brooklyn Botanic Garden",
       "departAt":"2026-08-11T14:00:00-04:00","returnAt":"2026-08-12T01:30:00-04:00"}'
```

Ask for a fourth trip on the same device and you get the 402 with purchasable
SKUs and conversion copy naming where you were actually trying to go. Packets
already on the device stay readable forever — the client never gates reads on
billing state.

The stack runs with **no GPU and no model endpoint**; that is a supported
posture, not a degraded one. `GET /ready` reports which it is
(`proseShaping: "deterministic" | "nim"`).

---

## Known limits

- **Micro-navigation data is a sample.** The headline feature needs field survey.
- **No live service alerts.** Planned changes load from a file or URL the sync
  worker writes; the GTFS‑Realtime adapter is unwritten because the endpoint is
  unreachable here and shipping unexercised feed parsing directly upstream of
  route correctness is a bad trade.
- **Geocoding is a ~50-landmark gazetteer.** Real deployment injects a proper
  geocoder through the `Geocoder` interface. Unknown addresses return null
  rather than a guess.
- **Boroughs are inferred from coordinates**, not read from a feed. Pinned by 11
  probes at the awkward edges (Marble Hill, Bay Ridge, the Rockaways).
- **The Staten Island Railway is out of scope** — different mode, own fare gates,
  ferry transfer. It is excluded explicitly rather than half-supported.
- **Walking is straight-line distance** at a deliberately unhurried 72 m/min. It
  does not know about street grids, closed sidewalks, or which bridges you can
  cross on foot.
- **The Expo client has never run on a device.** It typechecks and its pure
  logic is tested; the UI is unproven on glass.

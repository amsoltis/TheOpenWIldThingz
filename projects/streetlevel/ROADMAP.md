# The three moats

The routing engine is a commodity — anyone with the GTFS feed can build it. These
three are the reasons a traveller would choose this over the map app already on
their phone. Ranked by how hard they are to copy.

---

## 1 · Car position — ride in the right part of the train

Higher value than "which staircase", because it compounds: it saves walking at
every **transfer**, not only at the exit. A ten-car walk at 14 St costs three
minutes and happens twice a trip.

> Ride in one of the back three cars. The stairs you want at Eastern Pkwy are at
> the rear of the platform.

### The finding that changes the data model

A car *index* is the wrong unit. On the lettered lines, an 8-car train of 75-foot
cars and a 10-car train of 60-foot cars are both roughly 600 feet — so "car 5 of
10" and "car 4 of 8" are the same physical place. The numbered lines run shorter
cars again (~51 ft), so their ten-car trains are shorter than a lettered line's
eight-car train.

**Store position as a fraction of train length, not a car number.** Derive the car
index at render time from the consist actually running. `LineFocusConfig.expectedTrainCarIndex`
is under-specified today and should become a fraction plus a rendered zone.

Show it as a **zone**, never a number. A zone survives being wrong by one car; a
number does not, and it asks someone to count carriages on a crowded platform in
the forty seconds before the doors close.

### Three ways to get the data

| Route | What it gives | Cost & catch |
|---|---|---|
| Derive from geometry | Exit position along the platform → fraction of train length. Serves exits *and* transfer passages. | Free and automatic — **if** the agency publishes GTFS-Pathways node coordinates. It does not today. |
| Field survey | Ground truth, including what geometry misses: which stair is closed, which has a lift. | ~60–80 tourist-relevant stations at 10–15/day ≈ 1–2 person-weeks. Expensive enough nobody bothers, cheap enough that we can. |
| Crowdsourced telemetry | Self-improving: learn alignment from where users actually exited. | Cold start — needs the sensing work below, and needs users before it works. |

**Correction to an earlier claim in this repo's history:** car alignment was
described as having no authoritative source and requiring survey. That is only
true while pathways data is missing — the alignment is *derivable* from indoor
geometry. Survey is the bootstrap, not the permanent answer.

---

## 2 · Offline sensing — know the station with no signal

| Signal | Verdict | Why |
|---|---|---|
| Motion & barometer | **Build first** | Decelerate → dwell → accelerate counts stops. No external data, no partnership. Barometer separates "underground" from "surfaced". |
| BLE beacons | Investigate | Beacons were deployed across underground stations for wayfinding; scanning works offline. Needs the UUID→station map; iOS caps region monitoring at 20 and wants foreground for reliable ranging. |
| Wi-Fi fingerprint | Android only | Station AP BSSIDs identify a station. Android scanning is throttled but usable; iOS blocks it without an entitlement Apple rarely grants. |
| GPS | Useless | No sky underground. Stated because it is the first thing everyone reaches for. |

### Why motion wins, and why it is nearly free for us

Stop-counting only works if you know what to expect — and we already do. The
station graph carries the **median scheduled running time for every hop**, from
the agency's own timetable. A ride that should take 150 seconds before its first
stop is a strong prior: a deceleration at 40 seconds is noise, one at 145 is a
station. That turns a hard classification problem into a matched filter against a
sequence compiled before the traveller went underground.

The contract already anticipated this: `SensorValidationConfig` carries
`expectedTunnelTransitCount` and `expectedNextStationNodeName`.

**The rule that must not be broken:** sensing may only ever *offer* a position,
never assert one. "Looks like you're at 14 St — is that right?" A confidently
wrong position is worse than none, because it destroys trust exactly when the
traveller has no way to check us.

---

## 3 · Ask a New Yorker — point the camera at the wall

**Text recognition runs on-device, offline, for free.** Both mobile platforms ship
an on-device text recogniser. Station signs are the ideal subject: high contrast,
large type, and a fixed vocabulary of ~475 names already in the local SQLite
database. The photo never has to leave the phone.

The matcher already exists — `rankStations` takes free text, weights name tokens
by rarity (IDF), and refuses to answer when two candidates are too close. Camera
text is simply a better input than a frightened person typing one-handed.

### The graceful ladder

1. **Photo → on-device text → local match.** Offline, ~1s, no upload.
2. **Typed description → local ranker.** Also offline. Already built.
3. **Escalate to the model.** Only when 1 and 2 are ambiguous — and only then does
   anything leave the device.

Step 3 is where connectivity genuinely matters, and the honest answer is to say so
and be useful about it:

> I need a moment of signal for this one. Tunnels have none — platforms usually
> do. I'll send it the second we pull into the next station.

That is encodable rather than a guess: underground platforms have Wi-Fi coverage,
running tunnels do not. The app already knows when this will work.

**Build constraint:** on-device recognition needs a native module, moving the
client off Expo Go onto a development build. A one-time cost worth paying, but a
real change to how the project is built and tested.

---

## Sequencing

The order is not the ranking. It is driven by one dependency: crowdsourced car
alignment needs sensing, and sensing needs nothing.

1. **Camera → offline recovery.** Highest value per unit of work, no new data, and
   it makes the most emotional moment in the product feel like magic. Forces the
   dev-build migration early, while the app is small.
2. **Motion-based stop counting.** No dependencies, and the sensor substrate
   everything else learns from.
3. **Car position by survey, one corridor only.** Prove the instruction is worth
   the walking it saves before committing person-weeks.
4. **Pathways adapter** for the agency's entrance and lift inventories — turns
   survey from the permanent plan into the bootstrap.
5. **Crowdsourced alignment**, once there are riders and the sensing is trusted.

## What would kill each one

- **Car position:** being wrong. Sending someone to the back of a platform for a
  stair closed a year ago is worse than saying nothing. Survey records need an
  expiry date and a re-check cadence — the `surveyedOn` column exists for this.
- **Sensing:** battery, and false confidence. A 30-minute ride sampling motion is
  fine; leaving a radio scanning all day is not.
- **Camera recovery:** a sign behind a crowd, or a name that OCRs into a station
  on the other side of the city. `RECOVERY_CONFIDENCE_FLOOR` is the guard and it
  has to stay strict.

---

Claims about platform hardware and platform APIs are from general knowledge and
should be verified against current documentation before anyone commits a sprint
to them.

---

## 4 · Proficiency levels — the same packet, three densities

Built. `Proficiency` is `FIRST_TIME | BEEN_HERE | LOCAL`, and it is a
**rendering** decision, not a routing one: the packet is compiled once, carries
every level, and the client switches offline — because the moment someone wants
less detail is usually the moment they are already underground.

Real compiler output, same trip:

| Level | Platform card |
|---|---|
| `FIRST_TIME` | Wait here for the **3** train toward **New Lots Av** (heading into Brooklyn). *+ 3 anchors, diagrams, highlighting* |
| `BEEN_HERE` | Wait here for the **3** train toward **New Lots Av** (heading into Brooklyn). *+ 2 anchors* |
| `LOCAL` | **3** toward **New Lots Av**. |

Two rules hold it together:

- **The prohibition survives every level.** It is tempting to treat "do not board
  the first train unless the sign reads New Lots Av" as beginner content, but the
  mistake it prevents is not a beginner mistake — a local boards the wrong train
  precisely because they stopped reading.
- **Anchors truncate from the end**, because the compiler orders them by
  usefulness. Degrading drops the nice-to-know before the need-to-know.

Note that `containsCompassDirection` blocks true bearings (`north`, `southbound`)
but deliberately permits *uptown* / *downtown*, which are landmarks by
convention rather than bearings. Expert mode can speak like a local without
touching that guard.

Still to build: the `FIRST_TIME` scaffolding itself — highlighting and motion
that point at the thing to look for. `showScaffolding` is the flag; the animation
needs a device to judge.

---

## 5 · Where else the data can come from

### The licensing trap, stated before it costs anything

Google Maps Platform terms prohibit using their content to create or improve a
competing service or dataset, and restrict caching. Apple's mapping terms are
display-only within the app. **Harvesting either into our dataset is not
available to us**, however the data is obtained.

What *is* available: using a licensed API to answer a question for one user in
one session — geocoding an address they typed, for instance. That is what the
`Geocoder` interface exists for, and a paid provider drops in behind it without
touching anything else.

### The source that is actually better

**OpenStreetMap.** NYC's subway is mapped in genuine detail there —
`railway=subway_entrance` nodes, stairs, lifts, and in places full indoor
tagging. It is free, and ODbL permits commercial use with attribution and
share-alike on derived databases.

**And this connects directly to selling it to the city.** Open provenance is an
asset in that conversation: a dataset assembled from OSM, agency open data and
our own survey is one you are permitted to hand over. A dataset with Google
content in it is one you legally cannot. The cheap shortcut is the thing that
would kill the exit.

### Enhancing it by asking

The design principle: **ask at the moment of knowledge, not later.** As someone
steps off the train is exactly when they know whether the car was right. One
binary tap, on the card that just ended:

> Was that the right car for the exit? · Yes / Too far to walk

That feeds the highest-value dataset we have, from the only people positioned to
verify it. Station temperature is the same shape and lower stakes — a good
second question precisely because being wrong about it costs nothing.

The engineering caveat: a single report is not truth. One person's "wrong car"
may be them leaving by a different exit than the one we routed. Answers need
agreement thresholds before they change an instruction, and every surveyed record
already carries `surveyedOn` so a claim can age out.

---

## 6 · The competition: Mapway's *New York Subway MTA Map NYC*

Roughly 12 million downloads, free with advertising, and it already does more
than a first look suggests: the official MTA map, an A-to-B route planner that
routes to tourist attractions as well as stations, offline map and offline
route planning, live service status with push alerts, and countdown clocks.

*(Assembled from search summaries — the App Store listing itself is unreachable
from this build environment. Verify before quoting any of it.)*

### What they have that we do not

- **Distribution.** 12M downloads and a decade of ranking.
- **Live data.** Countdown clocks and service alerts. We have neither, and both
  come from realtime feeds this environment cannot reach.
- **The official map**, which is a genuine asset and an emotional one — people
  trust that diagram.
- **Tourist destinations in the planner**, so our landmark gazetteer is not a
  differentiator. It is table stakes.

### Why this is not the same product

Their planner answers **"which train, how long"**. It ends at the moment ours
begins.

> A to B · 5 stations · 18 min

Everything this project exists for happens after that sentence: which staircase,
which end of the platform, which train pulling in is *not* yours, what the sign
over your head should read, and what to do when you have got it wrong. A map
app tells you the route. It cannot tell you that the 1, 2 and 3 are all red and
you have to read the number.

**The strategic read: they are a map, we are a set of instructions.** A map is a
reference you consult; instructions are something you follow. Those are
different products for different moments, and the tourist standing at the top of
the wrong staircase is in our moment, not theirs.

### What they could copy, and what they could not

| | |
|---|---|
| Copy in a sprint | Plain-English step text, a card deck, proficiency levels. All of it is presentation over a route they already compute. |
| Copy in a quarter | Offline round-trip packets, the divergence warning. Engineering, not data. |
| **Cannot copy without the same work** | Entrance-level survey, car alignment, the recovery flow. The first two need someone in the stations; the third needs the confidence discipline more than the model. |

That table is the argument for the sequencing above: the defensible work is the
work that needs feet in stations and nerve about uncertainty, so it should start
before the presentation layer gets any more polish.

### And one wedge from their own reviews

The recurring complaint is that the app **now has ads**, and that the interface
is less friendly than Google Maps or Citymapper. A free ad-supported map has a
ceiling: it cannot charge, so it must monetise attention, which makes it worse
at the exact moment a lost tourist needs it most. Ours already refuses to show
a paywall to somebody who is lost. That is not a feature — it is the difference
in business model, made visible.

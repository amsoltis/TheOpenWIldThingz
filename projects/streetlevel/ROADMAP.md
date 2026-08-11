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

# The Open Wild Thingz

A **tool-archaeology & composition run** — hunting genuinely obscure open-source tools across
many fields and inventing non-obvious ways to chain them — **and the buildable projects it
spawned.** Discovery on one side, real shipped code on the other.

## Layout

```
.
├── discovery/                     # the research engine + its findings
│   ├── README.md                  # the full report: 52 verified tools, 15 cross-domain chains
│   ├── data/
│   │   └── verified-pool-and-chains.json   # raw verified pool + composed chains
│   └── pipeline/                  # the multi-agent orchestration scripts
│       ├── tool-discovery.mjs       # skim → verify → compose
│       ├── whitespace-hunt.mjs      # invent → adversarial prior-art → keep survivors
│       ├── whitespace-loop.mjs      # self-refining loop w/ well-posedness gate
│       └── scout.mjs                # triage → prior-art → spec the next build
│
├── discovery/NEXT-IDEAS.md        # the vetted ranking of what to build next
│
└── projects/
    ├── phonoglyph/                # ⭐ built #1: a self-pronouncing font (G2P in GSUB)
    │   ├── Phonoglyph.ttf         # the real, HarfBuzz-verified font (2,026 words)
    │   ├── demo/font.html         # type English, watch the font respell it
    │   └── site/                  # deploy-ready landing page (phonotype.soltis.house)
    ├── zoneland/                  # ⭐ built #2: an esolang whose source is timezones
    │   ├── zoneland.py            # the VM; opcodes are read live from UTC offsets
    │   └── examples/summer.zone   # silent in winter, prints SUMMER in summer — same file
    └── streetlevel/               # ⭐ built #3: plain-English NYC subway navigation
        ├── packages/router/       # Dijkstra over the real MTA graph, service-period aware
        ├── packages/shaper/       # routed path → swipeable plain-English instruction cards
        └── mobile/                # the Expo card deck a tourist actually holds
```

## 🔭 [`discovery/`](discovery/README.md) — the hunt

A four-tier multi-agent orchestration (skim on the cheapest model, verify on a mid model,
compose with the scarce reasoner, orchestrate + adjudicate at the top) surfaced **296 candidate
tools → 52 verified real → 15 novel cross-domain chains** across 19 fields. Highlights: a
constraint-grammar linguistics engine repurposed as a packet-flow IDS; hydrology software run on
photographs; an NLP skipgram miner cracking arcade-console memory dumps.

A follow-up **white-space hunt** then filtered for ideas that are *genuinely market-absent*
(every candidate attacked by adversarial prior-art searchers) rather than merely clever — which
is where the next section came from.

## ⭐ [`projects/phonoglyph/`](projects/phonoglyph/README.md) — the thing we built

The white-space hunt's most promising survivor, taken from idea to working artifact:
**the first font to compute English grapheme-to-phoneme respelling *entirely inside its own
GSUB table*** — `through → throo`, `nation → nay-shun` — with no JavaScript, and copy-paste
returns the original English.

- **Real & verified:** a 2,012-word `Phonoglyph.ttf`, shaping confirmed with HarfBuzz (the engine
  in Chrome/Firefox/Safari), including a working word-boundary guard.
- **Honest about limits:** English G2P is inherently approximate (homographs), and GSUB only
  runs in HarfBuzz/CoreType — not Windows DirectWrite. Both documented, not hidden.
- Full reproducible pipeline (dictionary builder → font builder → HarfBuzz verifier), two browser
  demos, and an honest [`MONETIZATION.md`](projects/phonoglyph/MONETIZATION.md).

Built on the proof from [jimparis/qr-font](https://github.com/jimparis/qr-font) that fonts can
compute; Phonoglyph is the first to point that at pronunciation.

## ⭐ [`projects/zoneland/`](projects/zoneland/README.md) — the second thing we built

The white-space scout's top pick (see [`discovery/NEXT-IDEAS.md`](discovery/NEXT-IDEAS.md)):
**an esolang whose source code is a list of IANA timezone names.** Each line's opcode and operand
are read *live* from that zone's UTC offset — and because a DST jump is +60 min and `60 mod 7 = 4`,
**Daylight Saving silently rewrites the instruction set twice a year.**

```
$ python3 zoneland.py run examples/summer.zone --date 2026-01-15   → (silent)
$ python3 zoneland.py run examples/summer.zone --date 2026-07-15   → SUMMER
$ python3 zoneland.py transitions examples/summer.zone             → the real dates it flips
```

Same unchanged file, different behavior by season. Pure-stdlib Python, zero runtime deps, 7/7
golden tests, and a synthesizer that spells words out of timezones. Well-posed (tzdata is a strict
host), zero prior art found — the payoff, like Phonoglyph, is pure delight.

## ⭐ [`projects/streetlevel/`](projects/streetlevel/README.md) — the third thing we built

**Plain-English NYC subway navigation for people who have never used it.** Not a map — a deck of
swipeable cards, one physical action each, generated above ground and followed underground with no
signal. Tourists don't get lost for want of a map; they get lost in the last thirty metres, and a 2D
map is silent on every one of those.

> **Wait here for the 3 train toward New Lots Av** (heading into Brooklyn)
> · You will also see red trains (1, 2) stopping here. They are dimmed on your screen because they
>   are not yours. Let them pass — you want the red 3.

Built on the MTA's own GTFS feed: 475 stations, 1,890 track edges, 613 transfers, and 104 express
hops that know which stations they fly past. The router is service-period aware — an early build
put a 2pm rider on a **4** train at 33 St, a stop it only makes overnight, which is exactly the
class of error the product exists to prevent. It warns you before you leave that your 1:30am
return is a different journey than your outbound, and it tells you to walk when walking is faster.

The language model is never allowed to author a fact: a deterministic compiler builds every packet
from schedule data, and the model may only rewrite prose that already survives a guard preserving
every station name, every stop count, and every line bullet.

155 tests. Honest about its gap: the entrance-level survey data that is the headline feature does
not exist in any public feed and needs a person standing in the station — so it ships as a schema
plus five clearly-labelled samples, and the compiler refuses to quote unverified prose as fact.

## How it was made

Everything here was produced by a deterministic multi-agent workflow (see `discovery/pipeline/`),
with a human steering the goals and an orchestrator planning, dispatching, verifying, and
adjudicating between tiers. Findings are labeled **verified / plausible / speculative**, and every
market-absence claim was checked by adversarial search — including the one that became Phonoglyph.

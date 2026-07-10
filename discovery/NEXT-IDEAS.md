# Next ideas to build — scouted & prior-art-vetted

The 15 white-space candidates from the hunt, ranked for **well-posed seam + weekend-buildability +
market-absence + delight**, with the top 6 sent through adversarial prior-art search
(2026-07-10). Same discipline as Phonoglyph: an idea only advances if it names a *non-trivial*
seam (the Velato lesson) and survives a real "prove it exists" attack.

## Recommendation: **Zoneland** 🏆  (runner-up: The Platonic Spam)

## Ranking

| Rank | Idea | Score | Prior art | Well-posed? | Note |
|---|---|:--:|---|:--:|---|
| 1 | **Zoneland** | 8 | **none found** | ✅ | The pick — strict tzdata host, best one-screen wow |
| 2 | **The Platonic Spam** | 9 | **none** (GTUBE is a magic string, not a generator) | ✅ | Runner-up; slightly higher utility, weaker demo |
| 3 | FIGlet × OCR Leaderboard | 9 | **partial** — Capscii + ASCII-CAPTCHA/OCR solvers exist | ✅ | The leaderboard itself is unpublished, but both halves are trodden |
| 4 | Oronym Foundry | 8 | **partial** — evashort/homophone, homophonizer, Mondegreen Generator | ✅ | CMUdict boundary-crossing re-segmentation already exists |
| 5 | Typographic Watersheds | 8 | none found | ⚠️ viz, not computation | Delightful but a visualization, not a language |
| 6 | Glyphcode | 7 | none found | ❌ | Never defines the stroke→opcode encoding (Velato trap) |
| — | Constellation Compiler | 7 | (not refuted) | ✅ | Star density may make lettering illegible; "best approximation" v0 |
| — | Villains of the DNS | 7 | — | soft | Generator; plausibility bar, not a hard seam |
| — | Flyable Words | 6 | — | ✅ | "Bookable" overclaims; v0 proves route *existence* |
| — | Quirkode | 6 | — | ✅ | Seam clean, but a *project* not a weekend (QR×Piet over-constrained) |
| — | Oronym Engine | 6 | — | ✅ | Generation (vs mining) may blow the weekend |
| — | Glossolalia Sieve | 5 | — | ❌ | Brainfuck permissiveness → "valid" is trivial (Velato trap) |
| — | Cartographic Brainfuck | 5 | — | ❌ | Same BF trap + GPS-trace access hurdle |
| — | Spectrum Philology | 4 | — | soft | Needs SDR hardware + a busy RF neighborhood; not a reliable weekend |
| — | Transit Tape | 3 | — | ❌ | "A timetable computes" is the Velato trap embodied |

**Survivors** (novel enough + well-posed): Zoneland · The Platonic Spam · (FIGlet & Oronym partial).

---

## The pick: Zoneland

**Tagline.** An esolang whose source code is a list of IANA timezone names — each instruction's
opcode and operand are read live from that zone's UTC offset — so the same program computes a
different result twice a year, when the Earth's DST policy rewrites the instruction set out from
under it. *The one program you cannot fully understand without knowing what day it is.*

**The seam (why it's well-posed, not a Velato mirage).** The substrate is IANA **tzdata** via
Python stdlib `zoneinfo` — the authoritative offset table. A program is newline-separated real zone
IDs. Execution is parameterized by a date `D`. For each zone the VM resolves `t = utcoffset(Z, D)`
in minutes, then derives two values from that one number:
- **operand** `v = t // 15` (offsets are multiples of 15 min)
- **opcode** `k = ((t mod 7) + 7) mod 7` (a 7-op ISA: ADD, SUB, MUL, XOR, EMIT, SKIPZ, HALT)

**The load-bearing trick:** a spring-forward DST transition adds exactly **60 minutes**, and
`60 mod 7 = 4` — so DST shifts *both* the opcode index and the operand by 4. Every DST-observing
line is silently rewritten twice a year, on that zone's real transition dates, by tzdata — not by
the programmer. "Valid" is fully checkable (`line ∈ zoneinfo.available_timezones()`); behavior is a
pure, reproducible function of `(program, date, tzdata version)`.

**Why it's new / how it differs.** Prior "time" esolangs read the clock as a runtime *input value*
you branch on. Zoneland makes real-world time-policy data the **opcode table** — the offset
determines which instruction each line even *is*, and IANA's *already-published future* DST
transitions rewrite that table on fixed dates without touching the source. Adversarial search
(esolang+timezone / +DST / +UTC-offset, GitHub topics, direct "Zoneland") surfaced **zero prior
art**.

**Weekend v0 (CLI, ~150 LOC, pure stdlib).**
- `zoneland.py`: VM + 7-op decoder + step budget; `run --date --trace --tzversion`; a `transitions`
  report listing the exact future dates each line's opcode/operand flips (a novel artifact itself).
- `examples/`: `hello.zone` (non-DST anchors), the flagship `season.zone` (different output in Jan
  vs Jul from one unchanged file), `equinox_halt.zone`.
- `test_zoneland.py`: golden tests pinned to a fixed tzdata version + fixed dates (reproducible CI).
- README with the ISA table + a Phonoglyph-style honest-limits section (inert non-DST zones;
  fractional offsets handled by `//15`; pin tzversion since offsets are political).

**The demo (one screen).**
```
$ zoneland run examples/season.zone --date 2026-01-15   → (winter output)
$ zoneland run examples/season.zone --date 2026-07-15   → (summer output)   # same file, unchanged
$ zoneland transitions examples/season.zone             → the real future dates its output flips
```

**Risks (honest).** Inert instructions (~30–40 non-DST zones) → curate a "DST-active palette";
tzdata drift → pin `--tzversion`; it's a toy (utility ~1) → defensible only if the *delight* lands,
exactly like Phonoglyph. Nail the one-screen reveal, don't add features.

## Runner-up: The Platonic Spam

Decompile SpamAssassin's public `.cf` rule/score corpus into a generator that synthesizes the
shortest RFC-5322 message maximizing static spam score, plus a **"spam golf"** leaderboard
(shortest prose scoring exactly 0). Genuinely unbuilt (GTUBE is a hand-picked magic string, not a
generator over the real rule DB), well-posed (SpamAssassin itself is the oracle), weekend-buildable,
slightly higher utility. Loses to Zoneland only on demo wattage.

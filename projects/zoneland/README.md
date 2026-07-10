# Zoneland — an esolang whose source code is a list of timezones

> The source is a list of IANA timezone names. Each line's **opcode and operand are read live
> from that zone's current UTC offset** — so the same program computes a different result twice a
> year, when Daylight Saving Time silently rewrites the instruction set out from under it.
> *The one program you can't fully understand without knowing what day it is.*

![status v0](https://img.shields.io/badge/status-v0-orange)
![python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue)
![deps none](https://img.shields.io/badge/runtime%20deps-none-green)

## The reveal (this really runs)

```
$ python3 zoneland.py run examples/summer.zone --date 2026-01-15
                                    ← (nothing: silent in winter)
$ python3 zoneland.py run examples/summer.zone --date 2026-07-15
SUMMER

$ python3 zoneland.py run examples/winter.zone --date 2026-01-15
WINTER
$ python3 zoneland.py run examples/winter.zone --date 2026-07-15
                                    ← (nothing: silent in summer)
```

Same file, not one byte changed. Then the mic-drop — ask *when* it flips:

```
$ python3 zoneland.py transitions examples/summer.zone
line  1  America/Anchorage   2026-11-01  offset -480→-540  op XOR→HALT
line  1  America/Anchorage   2027-03-14  offset -540→-480  op HALT→XOR
line  2  Australia/Eucla     (no DST — inert anchor)
...
```

Those are the **real, already-published dates** on which this program's meaning will change. You
didn't edit it. The Earth's timekeeping policy did.

## How it works

A program is a newline-separated list of real zone IDs (blank lines and `#` comments ignored).
Execution takes a single date `D` (default: today, or `--date`). For each zone `Z`:

```
t = utcoffset(Z, D)  in minutes east of UTC     (a signed integer, multiple of 15)
operand  v = t // 15
opcode   k = ((t mod 7) + 7) mod 7
```

**The 7-op ISA** (a linear accumulator machine):

| k | op | effect |
|---|-----|--------|
| 0 | `ADD`   | `acc += v` |
| 1 | `SUB`   | `acc -= v` |
| 2 | `MUL`   | `acc *= (v or 1)` |
| 3 | `XOR`   | `acc ^= abs(v)` |
| 4 | `EMIT`  | append `chr(acc & 0x7F)` to output |
| 5 | `SKIPZ` | if `acc == 0`, skip the next line |
| 6 | `HALT`  | stop |

**The load-bearing trick — why `mod 7`.** A spring-forward DST transition adds exactly **60
minutes** to a zone's offset, and `60 mod 7 = 4`. So DST shifts *both* the opcode index and the
operand by 4 — every DST-observing line is silently rewritten twice a year, on that zone's real
transition dates, by the tz database (not by you). Non-DST zones (`Etc/UTC`, most of Asia/Africa)
are stable **anchors** you compose against; southern-hemisphere zones flip on the opposite half of
the calendar, so a program can mean opposite things in opposite seasons for free.

"Valid" is fully checkable — every line must be in `zoneinfo.available_timezones()` — and behavior
is a pure, reproducible function of `(program, date, tzdata version)`. (No hand-waving about what
"runs": the substrate is IANA **tzdata** via Python's stdlib `zoneinfo`.)

## Examples

| file | winter (`--date 2026-01-15`) | summer (`--date 2026-07-15`) |
|------|------------------------------|------------------------------|
| `examples/hello.zone`  | `HELLO` | `HELLO` (anchors only — date-independent) |
| `examples/summer.zone` | *(silent)* | `SUMMER` |
| `examples/winter.zone` | `WINTER` | *(silent)* |

The seasonal files use one DST zone as a gate (`America/Anchorage` is `HALT` in January;
`America/Adak` is `HALT` in July) in front of a message spelled out with anchor zones.
`tools/synth.py` authors these — it walks the accumulator to each target byte via BFS over anchor
offsets — so you can regenerate them (`python3 tools/synth.py`) or spell your own
(`python3 tools/synth.py --emit "HI THERE"`).

## Run it

```bash
# stdlib only; on a system without an OS tz tree: pip install tzdata
python3 zoneland.py run examples/summer.zone --date 2026-07-15
python3 zoneland.py run examples/hello.zone --trace          # see each zone decode to an op
python3 zoneland.py transitions examples/winter.zone --years 2
python3 zoneland.py validate examples/hello.zone
python3 test_zoneland.py                                      # 7/7 golden tests
```

## Honest limits (in the spirit of the project)

- **It's a toy.** Utility ≈ 1. It earns its place on *delight*, not usefulness — like a good
  esolang should. The point is the one-screen "same file, different season, different answer."
- **~40 zones don't observe DST**, so a random program shows weak seasonal drift. Use `transitions`
  to see exactly which lines are *live* vs. inert anchors, and lean on DST-observing zones for the
  gates.
- **Offsets are political.** IANA can revise future DST rules, so a demo could rot years out; the
  examples pin **near-term 2026 dates**, and behavior is reproducible against a given tzdata version.
- Fractional offsets (India `+5:30`, Nepal `+5:45`, Chatham `+12:45`) are fine — everything is
  quantized by `// 15`.

## Why it's (as far as I can tell) new

Prior "time" esolangs read the clock as a runtime *input value* you branch on. Zoneland makes
real-world time-*policy* data the **opcode table** — the offset decides which instruction each
line even *is*, and IANA's already-published future DST transitions rewrite that table on fixed
dates without touching the source. Adversarial prior-art search (esolang + timezone / DST / UTC
offset, GitHub topics, direct name) turned up nothing as of 2026-07.

## License

MIT (`LICENSE`).

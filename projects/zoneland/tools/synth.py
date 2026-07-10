#!/usr/bin/env python3
"""
synth.py — author Zoneland programs that emit a chosen ASCII string.

How: "anchor" zones are the non-DST timezones, whose (opcode, operand) is the same
on every date. Using only ADD/SUB anchors we can walk the accumulator (mod 128) to
any target byte via breadth-first search, then append an EMIT anchor. A DST zone
placed in front acts as a seasonal gate (it decodes to HALT in one half of the
year), so the same file can speak in one season and stay silent in the other.

Regenerate the bundled examples:
    python3 tools/synth.py

Emit an arbitrary string (any date):
    python3 tools/synth.py --emit "HI THERE"
"""
import argparse
import collections
import os
import sys
from datetime import date as Date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import zoneland as zl

JAN = Date(2026, 1, 15)
JUL = Date(2026, 7, 15)
EX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "examples")


def _anchors():
    add, sub, emit = [], [], []
    for z in sorted(zl.available_timezones()):
        try:
            j = zl.decode(z, JAN)
            s = zl.decode(z, JUL)
        except Exception:
            continue
        if (j[1], j[2]) != (s[1], s[2]):
            continue  # DST-affected → not a stable anchor
        _, v, k = j
        if k == 0 and v:
            add.append((z, v))
        elif k == 1 and v:
            sub.append((z, v))
        elif k == 4:
            emit.append(z)
    return add, sub, emit


ADD, SUB, EMIT_ZONES = _anchors()
EMIT = EMIT_ZONES[0]
EDGES = [((v % 128), z) for z, v in ADD] + [((-v % 128), z) for z, v in SUB]


def _path(a, b):
    a, b = a % 128, b % 128
    if a == b:
        return []
    seen, q = {a}, collections.deque([(a, [])])
    while q:
        r, acc = q.popleft()
        for d, z in EDGES:
            nr = (r + d) % 128
            if nr == b:
                return acc + [z]
            if nr not in seen:
                seen.add(nr)
                q.append((nr, acc + [z]))
    raise RuntimeError("accumulator graph is disconnected mod 128")


def synth(text, start=0):
    prog, cur = [], start % 128
    for ch in text:
        prog += _path(cur, ord(ch)) + [EMIT]
        cur = ord(ch) % 128
    return prog


def _write(name, header, prog):
    with open(os.path.join(EX, name), "w", encoding="utf-8") as fh:
        fh.write(f"# {header}\n#\n# run:  python3 zoneland.py run examples/{name} --date 2026-07-15\n")
        fh.write("\n".join(prog) + "\n")


def regen():
    os.makedirs(EX, exist_ok=True)
    _write("hello.zone", "Anchors only -> spells HELLO on ANY date. Timezone offsets ARE the opcodes.",
           synth("HELLO"))
    # America/Anchorage: HALT in Jan, XOR(-32) in Jul -> silent in winter, SUMMER in summer
    _, vu, _ = zl.decode("America/Anchorage", JUL)
    _write("summer.zone", "Silent in winter, prints SUMMER in summer. Anchorage HALTs in January.",
           ["America/Anchorage"] + synth("SUMMER", 0 ^ abs(vu)))
    # America/Adak: MUL in Jan (acc stays 0), HALT in Jul -> WINTER in winter, silent in summer
    _write("winter.zone", "Prints WINTER in winter, silent in summer. Adak HALTs in July.",
           ["America/Adak"] + synth("WINTER", 0))
    for name in ("hello.zone", "summer.zone", "winter.zone"):
        prog = zl.parse(open(os.path.join(EX, name), encoding="utf-8").read())
        print(f"{name:12} JAN={zl.run(prog, JAN)[0]!r:10} JUL={zl.run(prog, JUL)[0]!r:10}")


def main(argv):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--emit", help="print a program that emits this string on any date")
    a = p.parse_args(argv)
    if a.emit:
        print("\n".join(synth(a.emit)))
    else:
        print(f"anchors: {len(ADD)} ADD, {len(SUB)} SUB, {len(EMIT_ZONES)} EMIT")
        regen()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

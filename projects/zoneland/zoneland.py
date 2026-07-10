#!/usr/bin/env python3
"""
Zoneland — an esolang whose source code is a list of IANA timezone names.

Each instruction's opcode and operand are read *live* from that zone's UTC offset
on the date you run the program. Because a spring-forward DST transition adds
exactly 60 minutes and 60 mod 7 == 4, DST silently shifts both the opcode and the
operand of every DST-observing line — twice a year, on that zone's real transition
dates, without touching the source file.

A program is a newline-separated list of real zone IDs (blank lines and #comments
ignored). Execution is parameterized by a single date (default: today, or --date).

Decode, per zone Z at date D:
    t = utcoffset(Z, D) in minutes east of UTC   (signed int; multiples of 15)
    operand v = t // 15
    opcode  k = ((t mod 7) + 7) mod 7

7-op ISA (a linear accumulator machine):
    0 ADD    acc += v
    1 SUB    acc -= v
    2 MUL    acc *= (v or 1)
    3 XOR    acc ^= abs(v)
    4 EMIT   out += chr(acc & 0x7F)
    5 SKIPZ  if acc == 0, skip the next zone line
    6 HALT   stop

"Valid" is fully checkable (every line in zoneinfo.available_timezones()); behavior
is a pure, reproducible function of (program, date, tzdata version).

Usage:
    zoneland.py run PROG.zone [--date YYYY-MM-DD] [--trace] [--budget N]
    zoneland.py transitions PROG.zone [--from YYYY-MM-DD] [--years N]
    zoneland.py validate PROG.zone
"""
import argparse
import sys
from datetime import date as Date, datetime, timedelta
from zoneinfo import ZoneInfo, available_timezones

OPS = ["ADD", "SUB", "MUL", "XOR", "EMIT", "SKIPZ", "HALT"]
_ZONES = None


def _valid_zones():
    global _ZONES
    if _ZONES is None:
        _ZONES = available_timezones()
    return _ZONES


def offset_minutes(zone, d):
    """UTC offset of `zone` at noon on date `d`, in minutes east of UTC."""
    off = datetime(d.year, d.month, d.day, 12, tzinfo=ZoneInfo(zone)).utcoffset()
    return int(off.total_seconds() // 60)


def decode(zone, d):
    """(offset_minutes, operand, opcode) for a zone on a date."""
    t = offset_minutes(zone, d)
    return t, t // 15, ((t % 7) + 7) % 7


def parse(text):
    """Program text -> list of zone-id lines (comments/blanks stripped)."""
    out = []
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            out.append(line)
    return out


def validate(zones):
    """Return list of (index, zone) for lines that are not real zone ids."""
    valid = _valid_zones()
    return [(i, z) for i, z in enumerate(zones) if z not in valid]


def run(zones, d, budget=100000, trace=False):
    """Execute a program on date d. Returns (output_str, trace_rows, halted)."""
    acc, out, pc, steps = 0, [], 0, 0
    rows = []
    halted = False
    while pc < len(zones) and steps < budget:
        z = zones[pc]
        t, v, k = decode(z, d)
        op = OPS[k]
        advance = 1
        if op == "ADD":
            acc += v
        elif op == "SUB":
            acc -= v
        elif op == "MUL":
            acc *= (v or 1)
        elif op == "XOR":
            acc ^= abs(v)
        elif op == "EMIT":
            out.append(chr(acc & 0x7F))
        elif op == "SKIPZ":
            if acc == 0:
                advance = 2
        elif op == "HALT":
            halted = True
        if trace:
            rows.append((pc, z, t, op, v, acc, "".join(out)))
        if op == "HALT":
            break
        pc += advance
        steps += 1
    return "".join(out), rows, halted


def _transition_dates(zone, start, years):
    """Dates in [start, start+years) where `zone`'s offset (opcode/operand) changes."""
    valid = _valid_zones()
    if zone not in valid:
        return []
    end = Date(start.year + years, start.month, start.day)
    d = start
    prev = offset_minutes(zone, d)
    hits = []
    d += timedelta(days=1)
    while d < end:
        cur = offset_minutes(zone, d)
        if cur != prev:
            hits.append((d, prev, cur))
            prev = cur
        d += timedelta(days=1)
    return hits


# ---------------- CLI ----------------
def _read(path):
    with open(path, encoding="utf-8") as fh:
        return parse(fh.read())


def cmd_run(args):
    zones = _read(args.prog)
    bad = validate(zones)
    if bad:
        for i, z in bad:
            print(f"line {i + 1}: not a real timezone: {z!r}", file=sys.stderr)
        return 2
    d = Date.fromisoformat(args.date) if args.date else Date.today()
    out, rows, halted = run(zones, d, budget=args.budget, trace=args.trace)
    if args.trace:
        print(f"# {args.prog} @ {d}  (tzdata via zoneinfo)")
        print(f"{'pc':>3}  {'zone':28} {'off':>6} {'op':6} {'v':>4} {'acc':>6}  out")
        for pc, z, t, op, v, acc, o in rows:
            print(f"{pc:>3}  {z:28} {t:>+6} {op:6} {v:>4} {acc:>6}  {o!r}")
        print(f"# halted={halted}")
    sys.stdout.write(out)
    if out and not out.endswith("\n"):
        sys.stdout.write("\n")
    return 0


def cmd_transitions(args):
    zones = _read(args.prog)
    start = Date.fromisoformat(getattr(args, "from")) if getattr(args, "from") else Date.today()
    print(f"# future opcode/operand flips for {args.prog}, {start} + {args.years}y")
    any_live = False
    for i, z in enumerate(zones):
        hits = _transition_dates(z, start, args.years)
        if not hits:
            print(f"line {i + 1:>2}  {z:28}  (no DST — inert anchor)")
            continue
        any_live = True
        for d, prev, cur in hits:
            pk = ((prev // 15) % 7 + 7) % 7
            ck = ((cur // 15) % 7 + 7) % 7
            print(f"line {i + 1:>2}  {z:28}  {d}  offset {prev:+}→{cur:+}  "
                  f"op {OPS[((prev % 7) + 7) % 7]}→{OPS[((cur % 7) + 7) % 7]}")
    if not any_live:
        print("# every line is a non-DST anchor — this program's meaning never drifts.")
    return 0


def cmd_validate(args):
    zones = _read(args.prog)
    bad = validate(zones)
    if bad:
        for i, z in bad:
            print(f"line {i + 1}: INVALID {z!r}")
        return 1
    print(f"OK: {len(zones)} valid zone lines")
    return 0


def main(argv):
    p = argparse.ArgumentParser(description="Zoneland — timezones as source code.")
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run", help="execute a program")
    r.add_argument("prog")
    r.add_argument("--date", help="YYYY-MM-DD (default: today)")
    r.add_argument("--trace", action="store_true")
    r.add_argument("--budget", type=int, default=100000)
    r.set_defaults(func=cmd_run)

    t = sub.add_parser("transitions", help="list future dates the program's meaning flips")
    t.add_argument("prog")
    t.add_argument("--from", help="YYYY-MM-DD (default: today)")
    t.add_argument("--years", type=int, default=1)
    t.set_defaults(func=cmd_transitions)

    v = sub.add_parser("validate", help="check all lines are real zones")
    v.add_argument("prog")
    v.set_defaults(func=cmd_validate)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except BrokenPipeError:
        # downstream closed the pipe (e.g. `| head`) — exit quietly
        try:
            sys.stdout.close()
        except Exception:
            pass
        sys.exit(0)

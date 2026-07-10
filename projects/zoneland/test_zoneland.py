#!/usr/bin/env python3
"""
Golden tests for Zoneland, pinned to fixed dates. Behavior is a pure function of
(program, date, tzdata version); these assume standard 2026 DST rules (stable in
the IANA database). Run:  python3 test_zoneland.py   (or: pytest)
"""
import os
import sys
from datetime import date as Date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zoneland as zl

JAN = Date(2026, 1, 15)   # northern winter — US DST off
JUL = Date(2026, 7, 15)   # northern summer — US DST on
HERE = os.path.dirname(os.path.abspath(__file__))


def _run(name, d):
    prog = zl.parse(open(os.path.join(HERE, "examples", name), encoding="utf-8").read())
    return zl.run(prog, d)[0]


def test_decode_utc_is_nop_zero():
    t, v, k = zl.decode("Etc/UTC", JAN)
    assert (t, v, k) == (0, 0, 0)  # offset 0 → operand 0, opcode 0 (ADD)


def test_dst_flips_opcode():
    # A spring-forward adds 60 min; 60 mod 7 == 4, so the opcode changes.
    _, _, k_win = zl.decode("America/Anchorage", JAN)
    _, _, k_sum = zl.decode("America/Anchorage", JUL)
    assert k_win != k_sum
    assert zl.OPS[k_win] == "HALT" and zl.OPS[k_sum] == "XOR"


def test_hello_is_date_independent():
    assert _run("hello.zone", JAN) == "HELLO"
    assert _run("hello.zone", JUL) == "HELLO"


def test_summer_only_speaks_in_summer():
    assert _run("summer.zone", JAN) == ""
    assert _run("summer.zone", JUL) == "SUMMER"


def test_winter_only_speaks_in_winter():
    assert _run("winter.zone", JAN) == "WINTER"
    assert _run("winter.zone", JUL) == ""


def test_validate_rejects_bogus_zone():
    bad = zl.validate(["Etc/UTC", "Not/AZone", "America/Anchorage"])
    assert bad == [(1, "Not/AZone")]


def test_transitions_finds_real_dst_dates():
    hits = zl._transition_dates("America/Anchorage", Date(2026, 1, 1), 1)
    dates = [d.isoformat() for d, _, _ in hits]
    assert "2026-03-08" in dates   # US spring-forward 2026
    assert "2026-11-01" in dates   # US fall-back 2026


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  ok   {t.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL {t.__name__}: {e}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)

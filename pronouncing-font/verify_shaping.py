#!/usr/bin/env python3
"""
verify_shaping.py — prove the built Phonoglyph.ttf actually shapes correctly,
using HarfBuzz (the same engine Chrome/Firefox/Safari use). This is the real
test: compiling is necessary but not sufficient.

    pip install uharfbuzz
    python3 verify_shaping.py

Checks:
  * dictionary words respell  (through -> throo)
  * word-boundary guard holds (the -> thuh, but NOT inside "theory")
"""
import sys
from fontTools.ttLib import TTFont

try:
    import uharfbuzz as hb
except ImportError:
    print("need uharfbuzz:  pip install uharfbuzz", file=sys.stderr)
    sys.exit(2)

FONT = "Phonoglyph.ttf"
order = TTFont(FONT).getGlyphOrder()
face = hb.Face(hb.Blob.from_file_path(FONT))
hbfont = hb.Font(face)


def shape(s):
    buf = hb.Buffer()
    buf.add_str(s)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"calt": True})
    out = []
    for info in buf.glyph_infos:
        g = order[info.codepoint]
        out.append("-" if g == "hyphen" else g if len(g) == 1 else "[" + g + "]")
    return "".join(out)


CASES = [
    ("through", "throo"),
    ("nation", "nay-shun"),
    ("typography", "ty-pog-ruh-fee"),
    ("the", "thuh"),
    ("there", "thair"),
    ("cough", "kof"),
]

ok = True
for word, expected in CASES:
    got = shape(word)
    status = "ok" if got == expected else "FAIL"
    if got != expected:
        ok = False
    print(f"  {word:12} -> {got:16} (expected {expected}) [{status}]")

# boundary guard, dictionary-independent: a dict word embedded between other
# letters must NOT collapse (it isn't a whole word there).
emb = shape("xthroughx")
emb_ok = (emb == "xthroughx")
if not emb_ok:
    ok = False
print(f"\n  boundary guard  'xthroughx' -> {emb}  [{'ok' if emb_ok else 'FAIL'}]")

print("\nVERIFY:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)

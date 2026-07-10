#!/usr/bin/env python3
"""
rules_fallback.py — approximate English respelling for out-of-dictionary words.

The dictionary (respellings.json) handles common + irregular words exactly.
Everything else falls back to these rules: greedy longest-match over a table of
digraphs / vowel-teams / single letters. This is DELIBERATELY approximate — it
will be wrong on irregulars (that's what the dictionary is for) and is
homograph-blind. See README 'Honest limits'.

Usage:
    python3 rules_fallback.py --selftest
    python3 rules_fallback.py brimstone flotilla   # respell arbitrary words
"""
import re
import sys

# Order matters: longest / most-specific patterns first (greedy left-to-right).
RULES = [
    # suffixes & trigraphs+
    ("tion", "shun"), ("sion", "zhun"), ("cious", "shus"), ("tious", "shus"),
    ("ough", "aw"), ("augh", "aw"), ("eigh", "ay"), ("igh", "y"),
    ("tch", "ch"), ("dge", "j"), ("ture", "chur"), ("ct", "kt"),
    # consonant digraphs
    ("ck", "k"), ("ph", "f"), ("wh", "w"), ("qu", "kw"), ("ch", "ch"),
    ("sh", "sh"), ("th", "th"), ("ng", "ng"), ("wr", "r"), ("kn", "n"),
    ("gn", "n"), ("gh", ""),
    # vowel teams
    ("ee", "ee"), ("ea", "ee"), ("oo", "oo"), ("ai", "ay"), ("ay", "ay"),
    ("oa", "oh"), ("ow", "ow"), ("ou", "ow"), ("oi", "oy"), ("oy", "oy"),
    ("au", "aw"), ("aw", "aw"), ("ew", "oo"), ("ey", "ee"), ("ie", "ee"),
    ("ar", "ar"), ("or", "or"), ("er", "ur"), ("ir", "ur"), ("ur", "ur"),
    # single letters
    ("a", "a"), ("e", "e"), ("i", "i"), ("o", "o"), ("u", "uh"),
    ("y", "y"), ("c", "k"), ("g", "g"), ("s", "s"), ("x", "ks"),
    ("b", "b"), ("d", "d"), ("f", "f"), ("h", "h"), ("j", "j"),
    ("k", "k"), ("l", "l"), ("m", "m"), ("n", "n"), ("p", "p"),
    ("r", "r"), ("t", "t"), ("v", "v"), ("w", "w"), ("z", "z"), ("q", "k"),
]


def respell_word(word):
    w = word.lower()
    # drop a silent final 'e' after a consonant (cake -> cak..., approximate)
    if len(w) > 2 and w.endswith("e") and w[-2] not in "aeiou":
        w = w[:-1]
    out = []
    i = 0
    while i < len(w):
        for pat, rep in RULES:
            if w.startswith(pat, i):
                out.append(rep)
                i += len(pat)
                break
        else:
            i += 1  # unknown char, skip
    return "".join(out)


def _selftest():
    samples = ["brimstone", "flotilla", "octopus", "brightness", "nation",
               "thunder", "quicksand", "gnarly", "phantom", "voyage"]
    ok = True
    for s in samples:
        r = respell_word(s)
        if not r:
            ok = False
        print(f"  {s:12} -> {r}")
    print("SELFTEST:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return _selftest()
    if len(argv) < 2:
        print(__doc__)
        return 1
    for word in argv[1:]:
        if re.match(r"^[A-Za-z]+$", word):
            print(f"{word} -> {respell_word(word)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

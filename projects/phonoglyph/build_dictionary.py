#!/usr/bin/env python3
"""
build_dictionary.py — scale respellings.json to the top-N most frequent English
words, using CMUdict for pronunciations and the curated seed for irregulars.

Inputs:
  cmudict.dict            (github.com/cmusphinx/cmudict)
  frequency list          (one word per line, most-frequent first, e.g.
                           github.com/first20hours/google-10000-english)
  respellings.seed.json   (hand-tuned overrides — irregulars like cough->kof)

Merge rule per word: use the hand-tuned seed if present (exact), else the
CMUdict-derived respelling (approximate). All seed words are always included.

Usage:
    python3 build_dictionary.py cmudict.dict freq.txt [top_n]  > respellings.json
"""
import json
import os
import re
import sys

from arpabet_respell import respell

HERE = os.path.dirname(os.path.abspath(__file__))
ALPHA = re.compile(r"^[a-z]+$")

# Web frequency lists are full of junk for a *spelling* dictionary: bare letters,
# unit/format abbreviations, and brand/file-extension tokens that CMUdict happens
# to have (mis)pronunciations for. Reject these from the auto-scaled pass; the
# hand-curated seed is merged in unconditionally afterward, so real short words
# (a, of, to, in, is, ...) are unaffected.
MIN_WORD_LEN = 3
NON_WORD_DENYLIST = {
    "pdf", "xml", "html", "css", "url", "usb", "dvd", "cd", "tv", "pc",
    "com", "www", "http", "https", "php", "ibm", "llc", "ltd", "inc",
    "usa", "uk", "faq", "seo", "ceo", "cfo", "atm", "gps", "mp3", "sms",
    "ebay", "aol", "url", "cnet", "url",
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "st",
}


def _is_real_word(w):
    return len(w) >= MIN_WORD_LEN and w not in NON_WORD_DENYLIST


def load_cmudict(path):
    d = {}
    with open(path, encoding="latin-1") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith(";;;"):
                continue
            parts = line.split()
            word = parts[0].lower()
            if "(" in word:            # skip alternate pronunciations word(2)
                continue
            if not ALPHA.match(word):  # letters only (drops 'bout, it's, etc.)
                continue
            phones = []
            for p in parts[1:]:
                if p.startswith("#"):  # strip trailing comment
                    break
                phones.append(p)
            if word not in d:          # keep first (primary) pronunciation
                d[word] = respell(phones)
    return d


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 1
    cmu = load_cmudict(argv[1])
    freq = [w.strip().lower() for w in open(argv[2], encoding="utf-8") if w.strip()]
    top_n = int(argv[3]) if len(argv) > 3 else 2000
    seed = json.load(open(os.path.join(HERE, "respellings.seed.json"), encoding="utf-8"))

    out = {"_note": "Auto-scaled by build_dictionary.py: top frequent words from "
                    "CMUdict, with hand-tuned seed overrides for irregulars. "
                    "Approximate + homograph-blind (see README)."}
    added = 0
    for w in freq:
        if added >= top_n:
            break
        if not ALPHA.match(w):
            continue
        if not _is_real_word(w):
            continue
        r = seed.get(w) or cmu.get(w)
        if not r:
            continue
        out[w] = r
        added += 1
    # always include every curated seed word (the irregulars showcase)
    for w, r in seed.items():
        if not w.startswith("_"):
            out.setdefault(w, r)

    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
    print(f"\n# wrote {len(out) - 1} words", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

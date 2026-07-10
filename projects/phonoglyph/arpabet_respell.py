#!/usr/bin/env python3
"""
arpabet_respell.py — convert CMUdict ARPAbet pronunciations into readable
phonetic respellings (e.g. N EY1 SH AH0 N -> "nay-shuhn").

This scales the seed dictionary (respellings.json) to the full CMU Pronouncing
Dictionary. It is APPROXIMATE by design (see README limits): homograph-blind,
and the syllabifier uses a simple onset rule, not full sonority sequencing.
Hand-tune the high-frequency words in respellings.json for the demo; use this
for the long tail.

Usage:
    python3 arpabet_respell.py --selftest
    python3 arpabet_respell.py cmudict.dict > respellings.full.json
        (CMUdict line format: "NATION  N EY1 SH AH0 N")
"""
import json
import re
import sys

VOWELS = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER",
          "EY", "IH", "IY", "OW", "OY", "UH", "UW"}

RESPELL = {
    # consonants
    "B": "b", "CH": "ch", "D": "d", "DH": "th", "F": "f", "G": "g", "HH": "h",
    "JH": "j", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ng", "P": "p",
    "R": "r", "S": "s", "SH": "sh", "T": "t", "TH": "th", "V": "v", "W": "w",
    "Y": "y", "Z": "z", "ZH": "zh",
    # vowels (most-common respelling; approximate)
    "AA": "ah", "AE": "a", "AH": "uh", "AO": "aw", "AW": "ow", "AY": "y",
    "EH": "e", "ER": "ur", "EY": "ay", "IH": "i", "IY": "ee", "OW": "oh",
    "OY": "oy", "UH": "oo", "UW": "oo",
}

STRESS = re.compile(r"\d+$")


def _strip_stress(ph):
    return STRESS.sub("", ph)


def respell(phonemes):
    """phonemes: list of ARPAbet symbols (with or without stress digits)."""
    phs = [_strip_stress(p).upper() for p in phonemes if p.strip()]
    if not phs:
        return ""
    # locate vowel nuclei
    vowel_idx = [i for i, p in enumerate(phs) if p in VOWELS]
    if not vowel_idx:
        # no vowel (rare / abbreviations) -> just concatenate consonant pieces
        return "".join(RESPELL.get(p, p.lower()) for p in phs)

    # build syllable boundaries: each syllable owns [onset..vowel..coda]
    syllables = [[] for _ in vowel_idx]
    # leading consonants -> onset of first syllable
    first_v = vowel_idx[0]
    syllables[0].extend(phs[:first_v])
    for s, v in enumerate(vowel_idx):
        syllables[s].append(phs[v])  # the nucleus
        nxt = vowel_idx[s + 1] if s + 1 < len(vowel_idx) else len(phs)
        between = phs[v + 1:nxt]
        if not between:
            continue
        if s + 1 == len(vowel_idx):
            # trailing consonants after the last vowel -> coda of last syllable
            syllables[s].extend(between)
        elif len(between) == 1:
            # single intervocalic consonant -> onset of the next syllable
            syllables[s + 1].extend(between)
        else:
            # split a cluster: first -> coda here, rest -> onset next
            syllables[s].append(between[0])
            syllables[s + 1].extend(between[1:])

    parts = ["".join(RESPELL.get(p, p.lower()) for p in syl) for syl in syllables]
    return "-".join(p for p in parts if p)


def _selftest():
    cases = {
        "NATION": "N EY1 SH AH0 N",
        "THROUGH": "TH R UW1",
        "COUGH": "K AO1 F",
        "TYPOGRAPHY": "T AY0 P AA1 G R AH0 F IY0",
        "ISLAND": "AY1 L AH0 N D",
        "PRONUNCIATION": "P R AH0 N AH2 N S IY0 EY1 SH AH0 N",
    }
    ok = True
    for word, pron in cases.items():
        out = respell(pron.split())
        flag = "ok" if out else "FAIL(empty)"
        if not out:
            ok = False
        print(f"  {word:16} {pron:32} -> {out:20} [{flag}]")
    print("SELFTEST:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


def _parse_cmudict(path):
    out = {}
    with open(path, encoding="latin-1") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith(";;;"):
                continue
            parts = line.split()
            word = parts[0].lower()
            if "(" in word:  # skip alternate pronunciations word(1), word(2)
                continue
            if not re.match(r"^[a-z']+$", word):
                continue
            phones = []
            for p in parts[1:]:
                if p.startswith("#"):  # strip trailing comment (same as build_dictionary.py)
                    break
                phones.append(p)
            out[word] = respell(phones)
    return out


def main(argv):
    if "--selftest" in argv:
        return _selftest()
    if len(argv) < 2:
        print(__doc__)
        return 1
    data = _parse_cmudict(argv[1])
    json.dump(data, sys.stdout, ensure_ascii=False, indent=0)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

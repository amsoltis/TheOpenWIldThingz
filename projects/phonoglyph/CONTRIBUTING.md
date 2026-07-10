# Contributing to Phonoglyph

Thanks for helping! Phonoglyph is a font that computes English→phonetic respelling inside its
own GSUB table. Contributions that keep it **honest** (about its approximate, homograph-blind
nature and its HarfBuzz-only reach) are especially welcome.

## Setup

```bash
pip install fonttools uharfbuzz
```

## The pipeline

```
respellings.seed.json  (hand-tuned irregulars, always wins)
        +  CMUdict + a frequency list
   → build_dictionary.py → respellings.json   (the baked dictionary)
   → build_font.py       → Phonoglyph.ttf      (boundary-guarded GSUB)
   → verify_shaping.py   → HarfBuzz proof it shapes correctly
```

Always run the verifier after touching anything that affects the font:

```bash
python3 build_font.py && python3 verify_shaping.py   # must print VERIFY: PASS
python3 arpabet_respell.py --selftest
python3 rules_fallback.py --selftest
```

## Common contributions

- **Fix a respelling.** Edit `respellings.seed.json` (seed entries override the auto-generated
  ones), then rebuild the dictionary + font. Keep respellings lowercase, hyphen-separated
  syllables (`nation → nay-shun`).
- **Add words.** Adjust `top_n` in the `build_dictionary.py` invocation, or add to the seed.
- **Improve the rule fallback.** Edit `rules_fallback.py` (and keep the compact JS port in
  `demo/index.html` roughly in sync).

## Ground rules

- Don't claim correctness the font can't deliver — it is **approximate and homograph-blind**
  by design. If you tighten accuracy, keep the honesty in the README.
- `verify_shaping.py` must stay green, including the word-boundary guard test.
- No invented flags in docs/scripts — cite real tool syntax or say "see docs".

## License of contributions

By contributing you agree your code is under **MIT** and any font/data changes under
**SIL OFL 1.1** (see `LICENSE`), matching the project.

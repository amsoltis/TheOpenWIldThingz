# Phonoglyph — a self-pronouncing font

*(consumer brand candidate: **Talking Font**; developer spec: a **G2P-in-GSUB** typeface)*

**What it is:** an OpenType font that rewrites English words into their **phonetic respelling
as you type** — `through → throo`, `cough → kof`, `nation → nay-shun` — with the computation
happening **entirely inside the font's GSUB table**. No JavaScript, no server, no preprocessing.
Because the substitution happens at the rendering layer, if you **select and copy** the
respelled text, it pastes back as the **original English**.

Nobody has built a grapheme-to-phoneme font before (verified below). This is the first.

---

## Why this is possible (the lineage)

A font *can* compute. This isn't a metaphor:

- **[jimparis/qr-font](https://github.com/jimparis/qr-font)** generates scannable QR codes —
  including the Reed-Solomon error-correction math — *entirely in GSUB rules*, and the QR still
  copy-pastes as text. It proves a font can run a bounded compiled circuit.
- **[Fontemon](https://gwern.net/turing-complete)** is a full choose-your-own-adventure game
  shipped as a single font file.
- OpenType shaping is **Turing-complete in HarfBuzz and CoreText** (see the
  [HN thread](https://news.ycombinator.com/item?id=9918285)).

Phonoglyph applies that same trick to a new target: **English pronunciation.**

## Why this is genuinely new (prior-art check, July 2026)

What exists today and is **not** this:

| Exists | What it actually is | Why it's not Phonoglyph |
|---|---|---|
| tophonetics, phoneticgen | **Web tools** — paste text, get IPA | External software, not a font; breaks copy-paste |
| IPA fonts (Doulos, Charis) | Render IPA glyphs **you type** | No conversion — you must already know the IPA |
| [Sound City Reading](https://www.soundcityreading.net/color-coded-vowels.html) | Books with **manually** color-coded vowels | Static, hand-authored per book; no computation |
| Dyslexia/phonics fonts | Weight or color letters | No contextual grapheme→phoneme conversion |

**No font computes English pronunciation inside itself.** That's the white space.

---

## ⚠️ Honest limits (read before you get excited)

This project is scoped by three hard truths. Ignoring them is how you build snake-oil.

1. **English G2P is inherently approximate — and it's not the font's fault, it's English's.**
   Homographs like *read / read*, *lead / lead*, *tear / tear*, *bass*, *wind*, *live*, *bow*
   have **identical spelling and different pronunciation**, resolvable only from sentence
   *meaning*. No spelling-based system — font, regex, or rules — can get these right without
   parsing semantics. **Phonoglyph is homograph-blind by design** and picks each word's most
   common pronunciation. It is a *reading aid*, not a phonetic authority.

2. **GSUB is bounded and engine-dependent.** It's Turing-complete only in **HarfBuzz &
   CoreText** — so this works in **Chrome, Firefox, Safari, GNOME**, but **not DirectWrite**
   (Windows / MS Office native rendering). HarfBuzz also **caps recursion depth at 6**, and
   qr-font itself maxes at 53 characters. You **cannot** cram all 134k CMUdict words in. That
   constraint is what drives the architecture below.

3. **The "font that reads pages aloud" product is a red ocean.** Speechify, NaturalReader,
   Read Aloud, the browser's own free `SpeechSynthesis` API — all entrenched. The **novel,
   defensible** thing here is *only* the computed-in-the-font, copy-paste-safe respelling.
   Ship that as a free, viral, open artifact. Don't build a startup on the TTS wrapper.

---

## Architecture — the hybrid that fits inside a font

To respect limit #2, Phonoglyph does **not** attempt a full dictionary lookup. Instead:

1. **Dictionary ligatures for the top ~1–3k words.** The most frequent English words (which
   cover the large majority of running text, and include the nasty irregulars — *through,
   cough, colonel, yacht, island*) are baked as **exact** GSUB substitutions. This is small
   enough to fit and correct for common text.
2. **Rule-based fallback** for out-of-dictionary words — approximate digraph/vowel rules
   (`tion → shun`, `ough → …`, `ph → f`). Clearly labeled approximate.

The dictionary half is generated from **CMUdict** (ARPAbet phonemes → readable respelling);
the fallback half is a small hand-tuned rule set.

```
CMUdict + frequency list ──▶ arpabet_respell.py ──▶ respellings.json
                                                          │
                                        generate_fea.py ──▶ respell.fea ──▶ (fontTools) ──▶ Phonoglyph.otf
                                                          │
                                              demo/index.html  (live browser preview)
```

---

## What's in this v0

| File | Status | What it does |
|---|---|---|
| `respellings.json` | ✅ real data | ~55 hand-tuned word→respelling pairs (the demo dictionary, incl. hard irregulars) |
| `arpabet_respell.py` | ✅ runs today | ARPAbet → respelling converter to scale the dictionary from full CMUdict |
| `rules_fallback.py` | ✅ runs today | Approximate respelling for out-of-dictionary words (greedy digraph/vowel-team rules) |
| `generate_fea.py` | ✅ emits real `.fea` | Turns `respellings.json` into GSUB rules (ligature-collapse → multiple-expand) |
| `demo/index.html` | ✅ open in a browser | JS preview: dictionary (green, exact) + rule fallback (amber, approximate) |
| `build_font.py` | ✅ builds a real font | Compiles **`Phonoglyph.ttf`** from DejaVu Sans + `respellings.json`, with boundary-guarded GSUB |
| `verify_shaping.py` | ✅ **PASS** | Shapes test strings through **HarfBuzz** to prove it works (not just compiles) |
| **`Phonoglyph.ttf`** | ✅ **real, HarfBuzz-verified** | The actual installable font. `through → throo`; `the` respells but does **not** fire inside `theory` |
| `demo/font.html` | ✅ open in a browser | The **real font** via `@font-face` — respelling done in GSUB, copy-paste returns English |

The demo is a **preview** of what the font will render (same word→respelling map, in JS). The
font is the actual artifact; the JS is the reference spec for its behavior.

## Try the preview now

```
# no build needed — just open it
open demo/index.html      # or drag it into Chrome/Firefox
```

## Build the real font (verified working)

```
pip install fonttools uharfbuzz
python3 build_font.py                 # -> Phonoglyph.ttf (+ Phonoglyph.fea)
python3 verify_shaping.py             # shapes test strings through HarfBuzz -> VERIFY: PASS
open demo/font.html                   # see the real font respell live in a browser
```

`build_font.py` output on the seed set: **61 words baked, 61 control glyphs, GSUB verified.**
The boundary guard (`ignore sub @letter <word>;`) is what makes `the` respell as a word but
stay untouched inside `theory` — confirmed by `verify_shaping.py`.

## Scale the dictionary

```
python3 arpabet_respell.py --selftest              # sanity-check the ARPAbet mapping
python3 arpabet_respell.py cmudict.dict > respellings.full.json   # needs CMUdict
python3 rules_fallback.py --selftest               # approximate OOV respelling
```

## Roadmap

- [x] Respelling scheme + seed dictionary + live preview
- [x] ARPAbet→respelling generator, `.fea` emitter
- [x] Rule-based fallback for out-of-dictionary words
- [x] **Compile a working, HarfBuzz-verified font with word-boundary GSUB guards** ✅
- [x] A `@font-face` web demo backed by the *real* font (`demo/font.html`)
- [ ] Bake the rule fallback into the font itself (so OOV words also respell in-font)
- [ ] Scale the dictionary to the top ~2k words via `arpabet_respell.py` + CMUdict
- [ ] Variable-font axis: respelling intensity (off → digraph hints → full respelling)

## License

Tooling: MIT (`LICENSE`). Any shipped font: **SIL OFL 1.1** (keeps it free and viral — that's
the point). Respellings derived from CMUdict inherit its permissive BSD-style terms.

## Credits / prior art it stands on

Jim Paris (qr-font, the proof that fonts compute) · CMU Pronouncing Dictionary · the OpenType
shaping community. Phonoglyph is the first to point the technique at grapheme-to-phoneme.

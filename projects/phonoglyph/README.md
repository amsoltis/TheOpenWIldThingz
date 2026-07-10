# Phonoglyph — a self-pronouncing font

> A font that respells English words phonetically as you type — entirely inside the font file,
> no JavaScript, no server — and still copy-pastes back as normal English.

![License OFL-1.1 / MIT](https://img.shields.io/badge/license-OFL--1.1%20%2F%20MIT-blue)
![Status v0 preview](https://img.shields.io/badge/status-v0%20preview-orange)
![Dictionary 2,026 words](https://img.shields.io/badge/dictionary-2%2C026%20words-green)

*(consumer brand candidate: **Talking Font**; developer spec: a **G2P-in-GSUB** typeface)*

<!-- TODO before public release: record demo/font.html (type → respell → select-copy-paste
     reveal) as a ~10-15s GIF, save to demo/screenshot.gif, and embed it here. -->

## Quickstart (30 seconds)

No build, no install — just open the demo in a browser:

```bash
git clone <this-repo> && cd projects/phonoglyph
open demo/index.html      # macOS; Linux: xdg-open; Windows: double-click
```

Type a sentence and watch it respell live (JS simulation — works with no font installed).
Want the **real font** doing the work with zero JavaScript? [Install the font](#install-the-font),
then open `demo/font.html`.

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
| `respellings.json` | ✅ **2,026 words** | The baked dictionary: top ~2k frequent words (CMUdict) + hand-tuned irregulars |
| `respellings.seed.json` | ✅ 61 curated | Hand-tuned overrides for irregulars (`cough→kof`), always merged in |
| `build_dictionary.py` | ✅ runs today | Scales `respellings.json` to top-N frequent words from CMUdict + a frequency list |
| `arpabet_respell.py` | ✅ runs today | ARPAbet → respelling converter used by `build_dictionary.py` |
| `rules_fallback.py` | ✅ runs today | Approximate respelling for out-of-dictionary words (greedy digraph/vowel-team rules) |
| `generate_fea.py` | ✅ emits real `.fea` | Turns `respellings.json` into GSUB rules (ligature-collapse → multiple-expand) |
| `demo/font.html` | ✅ **the real, no-JS demo** | Type into a box styled with `Phonoglyph.ttf`; the **font** respells it (no JS). Optional 🔊 Speak button uses the browser voice. |
| `demo/index.html` | ✅ JS **simulation** | Mockup of the logic in JavaScript, for when the font isn't installed: dictionary (green) + rule fallback (amber), click-a-word to hear it. |
| `build_font.py` | ✅ builds a real font | Compiles **`Phonoglyph.ttf`** from DejaVu Sans + `respellings.json`, with boundary-guarded GSUB |
| `verify_shaping.py` | ✅ **PASS** | Shapes test strings through **HarfBuzz** to prove it works (not just compiles) |
| **`Phonoglyph.ttf`** | ✅ **real, HarfBuzz-verified** | The actual installable font (2,026 words). `through → throo`; guard: `through` does **not** fire inside `xthroughx` |

Two demos, and the difference matters: **`font.html` is the real thing** — the font does the
respelling with **no JavaScript**. **`index.html` simulates it in JavaScript** so it still works
where the font isn't installed. Audio in both is the browser's built-in speech voice (separate
from the font, not part of it).

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

`build_font.py` bakes **2,026 words** into 50 chunked GSUB lookups. The boundary guard
(`ignore sub @letter <word>;`) makes a word respell only when whole — confirmed by
`verify_shaping.py` (`xthroughx` stays `xthroughx`).

> **Gotcha we hit:** one lookup holding all ~6,000 rules overflows the 16-bit GSUB subtable
> offset (fontTools raises a cryptic `repeatIndex` error). Fix: split rules across many small
> lookups (`COLLAPSE_CHUNK`/`EXPAND_CHUNK` in `build_font.py`).

## Install the font

A prebuilt `Phonoglyph.ttf` is included — you don't have to build it to try it.

**macOS:** `open Phonoglyph.ttf` → Font Book → *Install Font*.
**Windows:** right-click `Phonoglyph.ttf` → *Install*.
**Linux:**
```bash
mkdir -p ~/.local/share/fonts && cp Phonoglyph.ttf ~/.local/share/fonts/ && fc-cache -f
```
**Web (`@font-face`)** — what `demo/font.html` uses:
```css
@font-face { font-family: "Phonoglyph"; src: url("Phonoglyph.ttf") format("truetype"); }
.respell { font-family: "Phonoglyph", sans-serif; }
```
Any element styled with `font-family:"Phonoglyph"` renders its English respelled and still
copy-pastes as the original. Works in Chrome/Firefox/Safari (HarfBuzz/CoreText); **not** in
native Windows DirectWrite apps (see Honest limits #2).

## Scale the dictionary yourself

```
# 1. get the data
curl -L -o cmudict.dict https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
curl -L -o freq.txt https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa.txt
# 2. rebuild the dictionary (top 2000 words + seed overrides), then the font
python3 build_dictionary.py cmudict.dict freq.txt 2000 > respellings.json
python3 build_font.py && python3 verify_shaping.py
python3 rules_fallback.py --selftest               # approximate OOV respelling (JS demo only, for now)
```

## Roadmap

- [x] Respelling scheme + seed dictionary + live preview
- [x] ARPAbet→respelling generator, `.fea` emitter
- [x] Rule-based fallback for out-of-dictionary words
- [x] **Compile a working, HarfBuzz-verified font with word-boundary GSUB guards** ✅
- [x] A `@font-face` web demo backed by the *real* font (`demo/font.html`)
- [x] **Scale the dictionary to the top ~2k words** (CMUdict + frequency list) ✅
- [ ] Bake the rule fallback into the font itself (so OOV words also respell in-font)
- [ ] Variable-font axis: respelling intensity (off → digraph hints → full respelling)

## Show it off

- [`site/`](site/) — a self-contained landing page (real font + live demo + a no-code explainer),
  ready to deploy to Cloudflare Pages at `phonotype.soltis.house`. See [`site/DEPLOY.md`](site/DEPLOY.md).
- [`LINKEDIN.md`](LINKEDIN.md) — post drafts for announcing it (link to the demo, no code).

## License

Tooling: MIT (`LICENSE`). Any shipped font: **SIL OFL 1.1** (keeps it free and viral — that's
the point). Respellings derived from CMUdict inherit its permissive BSD-style terms.

## Credits / prior art it stands on

Jim Paris (qr-font, the proof that fonts compute) · CMU Pronouncing Dictionary · the OpenType
shaping community. Phonoglyph is the first to point the technique at grapheme-to-phoneme.

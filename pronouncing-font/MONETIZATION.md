# Monetization — the honest plan

Short version: **the font must be free, or it won't spread — and spreading *is* the value.**
Decide the model *before* the repo goes public. Don't ship free, build an audience, then
paywall it — free→paid retroactively burns the goodwill that got you the audience.

## What's actually defensible vs. what's a red ocean

- **Defensible / novel:** the *technique* — grapheme-to-phoneme computed inside the font, no
  JS, copy-paste-safe. Nobody else has it. That's reputation capital ("the person who does
  computation-in-fonts"). The compounding asset is **you + the repos**, not a subscription.
- **Red ocean (don't build a business on it):** a "reads pages aloud" extension competes with
  Speechify, NaturalReader, Read Aloud, and the browser's own free `SpeechSynthesis`. TTS is
  not the moat.

## Realistic model: open-core, decided up front

1. **Free core (SIL OFL 1.1):** the base Phonoglyph font — top ~1–3k words + rule fallback.
   This is the viral artifact. It gets stars, HN, blog posts. It is the marketing.
2. **Paid "Pro" packs** (this is where a dollar comes from, without rugging anyone):
   - full-CMUdict-baked variants, an **IPA** variant, and **variable-font intensity axis**
     (off → digraph hints → full respelling)
   - other languages (Spanish/German G2P are *more* regular than English — easier wins)
   - a polished, packaged installer + web-embed kit
3. **Paid app/extension, with a *trial* (your instinct — correct):** if you wrap it in a
   customizer/reader app, ship a **time-limited or feature-limited trial**, never free-then-
   paywall. The free *font* and the paid *app* are different products, so there's no rug.

## Why "trial, not free→paid" is the right call here

You can't cleanly convert a font that's already MIT/OFL in the wild back to paid — copies exist
forever. So: keep the **font** permanently free (that's the top of the funnel), and put the
price on things that are genuinely separable — the **app**, the **Pro packs**, **support/
commissions**. Those can be trial-gated from day one without betraying early users.

## Honest expectation

This is a **reputation + tip-jar + Pro-pack** play, not a SaaS unicorn (see the README's honest
scoring). The realistic upside is: a viral repo that becomes "your thing," modest Pro-pack /
donation revenue, and inbound consulting/commissions from being the font-hacker who shipped it.
Price the separable extras; give the wedge away.

## Pre-release checklist (do these before it's public)

- [ ] Pick the license split now (font = OFL, tooling = MIT) — already set.
- [ ] Decide free-core boundary (which words/features are free vs. Pro) *before* launch.
- [ ] If there's a paid app, wire the trial in from the first release.
- [ ] Ship the browser demo + a 20-second screen recording (the copy-paste-safe reveal sells it).

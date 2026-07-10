# LinkedIn post — drafts

Goal: a "look what I built, and here's how" flex that sends people to the live demo at
**phonotype.soltis.house**. No code shown. Pick one, tweak the voice to sound like you.

> Before posting: deploy the page (see `site/DEPLOY.md`) so the link is live, and record a
> ~12-second screen capture of typing in the demo + the copy→English reveal — a video/GIF gets
> far more reach than a link alone.

---

## Draft A — short & punchy (recommended)

I built a font that reads itself.

You type normal English — and the letters respell into how the words actually *sound*:
"through" → "throo", "colonel" → "kur-nul". Live, as you type.

The twist: there's **no app and no JavaScript** doing it. The pronunciation is computed *inside
the font file itself*. And because it only swaps the letter shapes — not the underlying text — you
can select it, copy it, and paste it, and it comes back as plain English.

Turns out modern fonts can run little programs while your text is being laid out (people have
hidden QR-code generators and even a playable game inside single font files). I pointed that
trick at English pronunciation.

It's honestly approximate — English is full of words spelled the same but said differently — so
it's a reading aid, not a dictionary. But watching a *font* pronounce words was too fun not to build.

Try it (type in the box): 👉 phonotype.soltis.house

#typography #fonts #creativecoding #buildinpublic #opentype

---

## Draft B — the builder's story (a bit longer)

"Can a font pronounce a word?"

That question turned into a weekend rabbit hole, and now it exists.

Type English into it and each word respells phonetically, in real time — "enough" → "ee-nuf",
"yacht" → "yot". No plugin, no script, no server. The whole thing runs *inside the font file*.

How? OpenType fonts quietly carry substitution tables that fire while text is shaped — powerful
enough that people have built QR codes and a video game entirely inside a font. I used the same
machinery to bake ~2,000 English words (and a pile of spelling→sound rules) into the font as glyph
substitutions. It only changes the shapes, so copy-paste still gives you the original English.

What I liked most was keeping it honest: English has homographs (read / read, lead / lead) that no
spelling-based system can resolve without understanding meaning — so it picks the most common
reading and says so plainly. Constraints make the thing more interesting, not less.

Live demo (it's doing the work in your browser): phonotype.soltis.house

Full technical write-up to follow. Happy to talk fonts, OpenType, or weird side projects.

#opentype #typography #softwareengineering #creativecoding #buildinpublic

---

## Draft C — one-liner (for a comment / repost)

Made a font that respells English into how it *sounds*, computed entirely inside the font file —
copy-paste still returns plain English. Try it: phonotype.soltis.house

---

### Notes
- Keep the repo/code out of the post for now (per plan). The page explains the *how* conceptually.
- If asked "is the code open?", reply that a write-up + code are coming — collect interest first.
- Best posting time for reach: mid-morning Tue–Thu. Lead with the video; put the link in the
  first comment if LinkedIn throttles link posts (it often does).

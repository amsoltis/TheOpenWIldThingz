# Deploy the demo to phonotype.soltis.house (Cloudflare Pages)

This `site/` folder is a complete static site (just `index.html` + `Phonoglyph.ttf`). Cloudflare
Pages hosts it free with automatic HTTPS.

## Option A — Wrangler CLI (fastest)

```bash
npm install -g wrangler
wrangler login                       # opens the browser once
cd projects/phonoglyph
wrangler pages deploy site --project-name phonotype
```
You'll get a `*.pages.dev` URL immediately. Then attach the custom domain (below).

## Option B — Dashboard (no CLI)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Name the project `phonotype`, drag in the **contents of `site/`** (the `index.html` and
   `Phonoglyph.ttf`), and **Deploy**.

## Point phonotype.soltis.house at it

`soltis.house` should already be on Cloudflare (same account). Then:

1. Open the **phonotype** Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter `phonotype.soltis.house`. Cloudflare adds the required `CNAME` automatically because the
   zone is on the same account. Wait for the cert (usually a minute or two).
3. Visit **https://phonotype.soltis.house** — done.

## Notes

- **Fonts serve fine by default.** Cloudflare Pages sends the right `Content-Type` for `.ttf`; no
  config needed. If you ever host elsewhere, make sure `.ttf` isn't blocked and CORS allows the
  font on the same origin (it's same-origin here, so nothing to do).
- **No build step, no dependencies, no analytics/trackers** — it's one HTML file and one font.
- **The page shows no source code** (per plan). It explains *how* it works conceptually and links
  nowhere private. Add a repo link later when you're ready to open the code.
- **Updating:** re-run the deploy command / re-upload after editing `index.html`. If you rebuild
  the font, copy the fresh `Phonoglyph.ttf` into `site/` first:
  `cp Phonoglyph.ttf site/Phonoglyph.ttf`.

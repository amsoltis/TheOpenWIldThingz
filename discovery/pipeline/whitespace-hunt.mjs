export const meta = {
  name: 'whitespace-hunt',
  description: 'Invent buildable open-source project ideas, then adversarially prove market-absence; keep only survivors',
  phases: [
    { title: 'Expand', detail: 'skim fresh tools/artifacts from the empty grid cells', model: 'claude-haiku-4-5' },
    { title: 'Invent', detail: 'compose buildable, would-be-novel repo ideas', model: 'claude-opus-4-8' },
    { title: 'Refute', detail: 'adversarial prior-art search: try to prove each idea already exists', model: 'claude-sonnet-5' },
  ],
}

// ---------- schemas ----------
const SKIM_SCHEMA = {
  type: 'object',
  properties: {
    finds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          repo: { type: 'string' },
          kind: { type: 'string' },
          one_liner: { type: 'string' },
          glue: { type: 'array', items: { type: 'string' } },
          source: { type: 'string' },
        },
        required: ['name', 'one_liner'],
      },
    },
  },
  required: ['finds'],
}

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          one_line: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          artifact_crossing: { type: 'boolean' },
          build_sketch: { type: 'string' },
          repo_contents: { type: 'string' },
          why_novel: { type: 'string' },
          closest_existing_guess: { type: 'string' },
          buildability: { type: 'string' },
          delight: { type: 'integer' },
          utility: { type: 'integer' },
        },
        required: ['name', 'one_line', 'build_sketch', 'why_novel', 'closest_existing_guess', 'buildability'],
      },
    },
  },
  required: ['ideas'],
}

const PRIORART_SCHEMA = {
  type: 'object',
  properties: {
    idea_name: { type: 'string' },
    queries_tried: { type: 'array', items: { type: 'string' } },
    exists: { type: 'string' }, // "yes" | "partial" | "no"
    closest_prior_art: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        url: { type: 'string' },
        what_it_does: { type: 'string' },
      },
    },
    gap: { type: 'string' },
    verdict_reason: { type: 'string' },
  },
  required: ['idea_name', 'exists', 'gap', 'verdict_reason'],
}

// ---------- confirmed white-space seeds (survived a real prior-art check already) ----------
const SEEDS = `ALREADY-CONFIRMED WHITE-SPACE (prior-art search came up empty — use as the bar to match or beat):
- "Atonal Turing Sieve": mine a large MIDI dataset for files that are ACCIDENTALLY valid, halting, output-producing Brainfuck programs under the Schoenberg esolang (programs ARE MIDI files). Found computation latent in human melody. No prior art.
- "Atonal Payload": a single MIDI that is simultaneously playable music AND, read via Schoenberg's semantics, a self-executing program that prints a hidden message. Polyglots exist for file-formats, but "valid music + executable via esolang" has no prior art.`

// ---------- run-1 verified palette (compact; real, composable OSS tools) ----------
const PALETTE = `RUN-1 VERIFIED TOOLS (real, composable): CG-3 (constraint-grammar rule engine, stdin cohorts), colibri-core (n-gram/skipgram/flexgram pattern models), Morfessor (unsupervised morphology), Nanocubes (in-memory spatiotemporal OLAP cube over HTTP), TauDEM (hydrology flow/watershed on any raster), SedonaDB (spatial SQL on Arrow), QuackOSM (OSM PBF -> GeoParquet), jvarkit (awk-for-VCF/BAM via JS expr), smof (FASTA toolkit), zindex (random access into compressed text), grabix (BGZF random access), xyz2mol (XYZ->SMILES), PaulStretch (extreme time-stretch), FreqTweak (spectral manipulation over JACK), Nallely (MIDI meta-synth over websocket bus), stegify (LSB stego), Aletheia (ML steganalysis), VapourSynth+mvtools (motion-compensated video filtering), ImplicitCAD/LibFive (f-rep CAD via DSL/Scheme), odexp (CLI ODE/SDE solver), Axiom (1973 computer algebra system), netsniff-ng (zero-copy packet toolkit), Schoenberg (esolang: programs are MIDI files), Chef (esolang: programs are recipes), patat (terminal slides via Pandoc), Entangled (bidirectional literate-programming tangle daemon), famfs (CXL fabric-attached-memory FUSE fs), Venti (content-addressed write-once store), Pastvu (geotagged historical-photo feed+API), Justlog (Twitch chat HTTP API), dwarf2json (ELF/DWARF -> Volatility ISF JSON), gr-nrf24-sniffer (SDR RF sniff via FIFO), SRAM Dumper (arcade SRAM .bin dumps).`

const HUBS = `HUB TOOLS (free to use): jq, awk, ffmpeg, imagemagick, sox, duckdb, sqlite, graphviz/dot, tesseract(OCR), pandoc, fzf, socat, watchexec, curl, yt-dlp, exiftool, fontforge, gnuplot.`

// ================= EXPAND (skim fresh cells) =================
phase('Expand')
const WEB = "You have web access. FIRST call ToolSearch with query 'select:WebSearch,WebFetch' to load the web tools, then actually run WebSearch — do not answer from memory. Cite a real source URL for each."
const CELLS = [
  { c: 'local AI models as artifacts', hint: "whisper.cpp, piper (TTS), llamafile, sherpa-onnx, ONNX model zoo, tiny task models, embedding CLIs, silero-vad, RVC voice models, tesseract langdata. Things that expose a local CLI/HTTP inference endpoint." },
  { c: 'grammars & parsers', hint: "tree-sitter grammar org + tools (ast-grep, difftastic, tree-grepper), ANTLR grammar zoo, TextMate/Sublime syntaxes, kaitai struct format specs. Artifacts that generate a parser you can run over ANY data." },
  { c: 'rulesets & detection artifacts', hint: "YARA rule repos, Sigma rules, Semgrep registry, Suricata/Snort signatures, EasyList/uBO filter lists, StevenBlack hosts blocklist. Pattern engines you can point at non-intended data." },
  { c: 'fonts, typefaces & type tech', hint: "Nerd Fonts, Google Fonts, variable fonts, OpenType feature files (.fea), fontTools/fontforge, ligature fonts, color/emoji fonts, hershey vector fonts, figlet fonts. A font is a file you rasterize to pixels/paths." },
  { c: 'esolangs, notation & generative DSLs', hint: "LilyPond, ABC notation, Orca, bytebeat, Piet, Befunge, uxn/varvara, Hydra (video synth), Sonic Pi/Strudel/TidalCycles, Context Free Art, Structure Synth, shader DSLs. Notation that compiles to sound/image/geometry." },
  { c: 'open datasets, feeds & data files', hint: "GTFS transit, OpenStreetMap, GDELT, Project Gutenberg, Wikidata, tzdata, Unicode UCD, public-suffix list, NWS weather, arXiv, Lakh MIDI, WordNet, CMU pronouncing dict, OpenFlights. Newline/CSV/JSON/RSS you can pipe into anything." },
  { c: 'creative-coding, hardware & preservation oddities', hint: "nannou, Processing/p5, svg-to-gcode/pen-plotter tools, QMK/ZMK keyboard firmware, Meshtastic, rtl_433, Marlin, decompilation projects, libretro cores, ScummVM, demoscene/ANSI-art tools, plotter art." },
]
const skimFinds = await parallel(CELLS.map((cell) => () =>
  agent(
    `You are a fast READ-ONLY scout for genuinely composable open-source tools AND non-tool artifacts. Area: "${cell.c}".
${WEB}
Look at: ${cell.hint}
For each, extract: name, repo/URL, kind (tool | model | grammar | ruleset | font | dataset | feed | notation-dsl | firmware), one-line description, glue it exposes (CLI/stdin/json/http/file/pattern-engine/rasterizable/etc), and source URL. Prefer the obscure and the unusually reusable. Return 8-12 finds.`,
    { label: `expand:${cell.c}`, phase: 'Expand', schema: SKIM_SCHEMA, model: 'claude-haiku-4-5', effort: 'low' }
  ).then((r) => (r && r.finds) || [])
))
const freshPalette = skimFinds.filter(Boolean).flat()
  .map((f) => `${f.name} [${f.kind || '?'}] - ${f.one_liner}`).slice(0, 90).join('\n')
log(`Expanded palette with ${skimFinds.filter(Boolean).flat().length} fresh tools/artifacts`)

// ================= INVENT =================
phase('Invent')
const TRAP = `AVOID THE PRIOR-ART TRAP: do NOT propose "use tool X to do capability Y" when field Y already has a native tool for Y — that ALWAYS has prior art (that is why watershed-on-images, adversarial-steganalysis, and binary-format-inference all already exist). Market-absence survives only where nobody had a REASON to build the thing. So aim at: brand-new primitives, novel artifacts, delightful "toys", and crossings so far apart nobody bothered.`
const AIM = `TARGET: ideas that are (a) plausibly MARKET-ABSENT (nothing like it exists as tool/product/paper/repo) and (b) BUILDABLE as a small public repo (a weekend for a v0). Utility is a BONUS not a requirement — a delightful/astonishing artifact nobody built because nobody "needed" it is IDEAL repo material (an esolang, a strange converter, a "wait, that works?" toy). Bias hard toward "nobody has made that?!"`
const MANDATES = [
  { key: 'artifact-alchemy', ask: "Invent 4 ideas that each turn a NON-TOOL ARTIFACT (a font, blocklist, dataset, grammar, ruleset, model, firmware, or public feed) into fuel for something it was never meant for. The stranger the artifact's second life, the better." },
  { key: 'new-primitives', ask: "Invent 4 ideas that are NEW PRIMITIVES or NEW FILE-FORMAT/ESOLANG-style artifacts — a converter, a language, an encoding, a viewer — that simply does not exist yet. Think in the spirit of the Schoenberg seeds." },
  { key: 'far-crossings', ask: "Invent 4 ideas pairing tools/artifacts from maximally-distant domains (e.g. type technology x bioinformatics, transit feeds x audio synthesis, keyboard firmware x OSINT) such that the crossing itself is the novelty and nobody had reason to try it." },
  { key: 'delight-toys', ask: "Invent 4 ideas optimized for pure delight/astonishment that are still small and buildable — the kind of repo that hits the Hacker News front page for being gloriously clever, not useful. Feasibility of a v0 in a weekend is required." },
]
const invented = await parallel(MANDATES.map((m) => () =>
  agent(
    `You are inventing genuinely NEW things to build and publish as small open-source repos.
${AIM}
${TRAP}
${SEEDS}
${PALETTE}
FRESH PALETTE (just-skimmed tools/artifacts you may also use):
${freshPalette}
${HUBS}
You may also use any well-known open-source tool or public artifact.

${m.ask}
For each idea return: name, one_line, tools used, artifact_crossing (bool), a concrete build_sketch (real commands/APIs or "see docs"), repo_contents (what the v0 repo would contain), why_novel (specifically WHY you believe nothing does this yet), closest_existing_guess (your honest best guess at the nearest thing that DOES exist), buildability (afternoon|weekend|project), delight 1-5, utility 1-5.
Be bold and specific. A concrete weird idea beats a vague grand one.`,
    { label: `invent:${m.key}`, phase: 'Invent', schema: IDEA_SCHEMA, model: 'claude-opus-4-8', effort: 'high' }
  ).then((r) => ((r && r.ideas) || []).map((x) => ({ ...x, batch: m.key })))
))

// dedup ideas by normalized name (barrier genuinely needed: avoid verifying duplicates)
let ideas = invented.filter(Boolean).flat()
const iseen = new Map()
for (const it of ideas) {
  const k = String(it.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  if (k && !iseen.has(k)) iseen.set(k, it)
}
ideas = Array.from(iseen.values()).slice(0, 18)
log(`Invented ${ideas.length} unique candidate ideas -> adversarial prior-art refutation`)

// ================= REFUTE (adversarial prior-art) =================
phase('Refute')
const REFUTE = (idea, angle) => `Your job is to REFUTE the claim that this project idea is novel. Be a skeptic, not a booster.
${WEB}
Search AGGRESSIVELY from this angle: ${angle}. Try the capability, the specific tool/artifact names, likely project names, GitHub, awesome-lists, papers, Hacker News, blog posts. Run several distinct queries.
Then judge \`exists\`:
- "yes"  = an existing tool/product/paper/repo already does essentially this.
- "partial" = a near-neighbor exists but a real, describable gap remains.
- "no"  = after genuine searching you could not find anything close.
Always report the CLOSEST prior art you found (name, url, what it does) even when concluding "no", and state the precise \`gap\`. Default to "partial" or "yes" if uncertain.
IDEA:
name: ${idea.name}
one_line: ${idea.one_line}
build_sketch: ${idea.build_sketch}
why_the_author_thinks_it_is_novel: ${idea.why_novel}
author_guess_at_closest_existing: ${idea.closest_existing_guess}`

const ANGLES = [
  "search for an existing tool/repo/product that already implements this exact capability",
  "search academic papers, Hacker News, and blog posts for anyone who has described or demoed this idea",
]
const refuted = await parallel(ideas.map((idea) => () =>
  parallel(ANGLES.map((angle, ai) => () =>
    agent(REFUTE(idea, angle), {
      label: `refute:${String(idea.name).slice(0, 24)}#${ai + 1}`,
      phase: 'Refute', schema: PRIORART_SCHEMA, model: 'claude-sonnet-5', effort: 'medium',
    })
  )).then((verdicts) => {
    const vs = verdicts.filter(Boolean)
    // survivor logic: an idea survives only if NEITHER searcher found "yes"
    const anyYes = vs.some((v) => (v.exists || '').toLowerCase() === 'yes')
    const anyNo = vs.some((v) => (v.exists || '').toLowerCase() === 'no')
    const status = anyYes ? 'exists' : (anyNo ? 'white-space' : 'partial')
    return { idea, verdicts: vs, status }
  })
))

const results = refuted.filter(Boolean)
const survivors = results.filter((r) => r.status === 'white-space')
const partial = results.filter((r) => r.status === 'partial')
const dead = results.filter((r) => r.status === 'exists')
log(`Refutation done: ${survivors.length} white-space, ${partial.length} partial-gap, ${dead.length} already-exist`)

// rank survivors + partials by delight+utility+buildability
function score(r) {
  const i = r.idea
  const buildRank = { afternoon: 3, weekend: 2, project: 1 }[(i.buildability || '').toLowerCase()] || 1
  return (i.delight || 0) * 2 + (i.utility || 0) + buildRank + (r.status === 'white-space' ? 4 : 0)
}
survivors.sort((a, b) => score(b) - score(a))
partial.sort((a, b) => score(b) - score(a))

return {
  stats: { invented: ideas.length, white_space: survivors.length, partial: partial.length, exists: dead.length },
  survivors,
  partial,
  dead: dead.map((r) => ({ name: r.idea.name, closest: r.verdicts.map((v) => v.closest_prior_art).filter(Boolean) })),
}

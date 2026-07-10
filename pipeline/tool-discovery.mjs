export const meta = {
  name: 'tool-discovery-composition',
  description: 'Four-tier hunt: skim obscure OSS tools across a domain grid, verify them, compose novel cross-domain chains',
  phases: [
    { title: 'Skim', detail: 'wide read-only fan-out across grid cells + artifact reservoirs', model: 'claude-haiku-4-5' },
    { title: 'Verify', detail: 'confirm repos/license/glue on the triaged shortlist', model: 'claude-sonnet-5' },
    { title: 'Compose', detail: 'invent emergent multi-tool chains from the verified pool', model: 'claude-opus-4-8' },
  ],
}

// ---------- schemas ----------
const SKIM_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          repo: { type: 'string' },
          field: { type: 'string' },
          one_liner: { type: 'string' },
          apparent_glue: { type: 'array', items: { type: 'string' } },
          oddness: { type: 'integer' },
          source: { type: 'string' },
        },
        required: ['name', 'repo', 'field', 'one_liner', 'oddness'],
      },
    },
  },
  required: ['candidates'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verified: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          repo: { type: 'string' },
          field: { type: 'string' },
          one_liner: { type: 'string' },
          speaks: { type: 'array', items: { type: 'string' } },
          stars: { type: 'string' },
          license: { type: 'string' },
          last_commit: { type: 'string' },
          artifact_type: { type: 'string' },
          oddness: { type: 'integer' },
          exists: { type: 'boolean' },
          verify_notes: { type: 'string' },
        },
        required: ['name', 'repo', 'exists', 'speaks', 'verify_notes'],
      },
    },
  },
  required: ['verified'],
}

const COMPOSE_SCHEMA = {
  type: 'object',
  properties: {
    chains: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chain_name: { type: 'string' },
          tools: { type: 'array', items: { type: 'string' } },
          roles: { type: 'string' },
          glue: { type: 'string' },
          emergent_capability: { type: 'string' },
          sketch: { type: 'string' },
          pattern: { type: 'string' },
          domains_bridged: { type: 'array', items: { type: 'string' } },
          scores: {
            type: 'object',
            properties: {
              nonobvious: { type: 'integer' },
              emergence: { type: 'integer' },
              crossdomain: { type: 'integer' },
              payoff: { type: 'integer' },
              feasibility: { type: 'number' },
            },
            required: ['nonobvious', 'emergence', 'crossdomain', 'payoff', 'feasibility'],
          },
          verdict: { type: 'string' },
          verdict_reason: { type: 'string' },
          fragile_seam: { type: 'string' },
          confidence: { type: 'string' },
        },
        required: ['chain_name', 'tools', 'glue', 'emergent_capability', 'sketch', 'scores', 'verdict', 'confidence'],
      },
    },
  },
  required: ['chains'],
}

// ---------- skimmer grid ----------
const WEB = "You have web access. FIRST call ToolSearch with query 'select:WebSearch,WebFetch' to load the web tools, then actually run WebSearch queries — do NOT answer from memory. Every candidate must come from a real page you saw; put that page URL in `source`."
const LEGIT = "Legitimacy filter: keep tools whose primary above-board purpose is research, journalism, defensive security, data analysis, art, or personal automation. DROP anything whose main purpose is stalking, doxxing, non-consensual surveillance, credential theft, or malware. When unsure, skip it."
const SKEW = "Skew HARD toward the obscure, abandoned-but-brilliant, and niche. Skip anything famous (git, docker, nginx, vscode, react). Rate oddness 1-5 (5 = you've never heard of it and it sounds strange). Aim for 8-12 candidates."

const CELLS = [
  { field: 'text/NLP', hint: "awesome-nlp long tail, unusual command-line text/linguistics tools, JSONL/stdin text processors, phonetics, diff/merge oddities" },
  { field: 'audio/DSP', hint: "awesome-audio, command-line DSP beyond ffmpeg/sox, audio fingerprinting, spectral tools, csound/faust/supercollider ecosystem" },
  { field: 'image/graphics', hint: "unconventional image manipulation CLIs, ASCII/ANSI art, image-to-data, pixel-sorting, content-aware oddities, netpbm ecosystem" },
  { field: 'video', hint: "command-line video tools beyond the obvious, frame extraction, timelapse, video-as-data, ffmpeg filter oddities, mpv scripting" },
  { field: '3D/CAD', hint: "programmatic/parametric CAD, mesh manipulation CLIs, point clouds, OpenSCAD alternatives, 3D-to-2D, procedural geometry" },
  { field: 'mapping/GIS', hint: "awesome-gis/geospatial long tail, GDAL-adjacent CLIs, vector tiles, geocoding, GPX/KML tools, terrain, spatial SQL" },
  { field: 'data/analytics', hint: "columnar/dataframe CLIs (Miller, DuckDB, dasel, VisiData, xsv/qsv), unusual data-wrangling tools, SQLite-as-interchange" },
  { field: 'scientific/simulation', hint: "awesome scientific-computing, physics/ODE/agent-based sim CLIs, units calculators, symbolic math, plotting-from-stdin" },
  { field: 'bio/chem', hint: "awesome-bioinformatics/cheminformatics CLIs, FASTA/SAM/PDB tooling, molecule SMILES tools, sequence stream processors" },
  { field: 'hardware/IoT/embedded', hint: "ESPHome/Tasmota-adjacent, serial/MQTT/BLE CLIs, SDR (rtl_433, GNU Radio), logic analyzers, firmware flashers, sensor bridges" },
  { field: 'networking', hint: "obscure networking/packet CLIs, socat-adjacent plumbing, mDNS, tunneling, mitmproxy scripting, DNS oddities, PCAP-to-data" },
  { field: 'security/crypto (defensive)', hint: "blue-team/detection tooling, YARA/Sigma engines, steganography, crypto CLIs, log parsers, forensic carvers. Defensive only." },
  { field: 'OSINT/recon (legit)', hint: "awesome-osint for research/journalism: geolocation, metadata extraction (exiftool-adjacent), archive tools, public-record parsers, data-analysis. Research/defensive only." },
  { field: 'music/MIDI', hint: "LilyPond/ABC notation, MIDI stream CLIs, algorithmic composition, tracker formats, live-coding (Sonic Pi/TidalCycles/Strudel), chiptune tools" },
  { field: 'game/emulation', hint: "libretro cores, decompilation projects, game reimplementations (OpenMW/OpenRA/devilutionX), ROM/asset extractors, memory-dump tools" },
  { field: 'automation/scraping', hint: "file watchers (entr/watchexec), unusual scrapers, RSS/feed tooling, browser automation CLIs, clipboard automation, ical/webcal tools" },
  { field: 'docs/publishing', hint: "diagram-as-code beyond mermaid (D2, Graphviz, PlantUML, Typst, Pandoc filters), markdown pipelines, slide-from-text, PDF surgery tools" },
  { field: 'finance/markets', hint: "open-source finance/market-data CLIs, plaintext accounting (hledger/beancount), backtesting, ticker feeds, crypto/ledger analysis" },
  { field: 'AI/ML / models-as-artifact', hint: "runnable local models: Whisper.cpp/Piper (STT/TTS), tiny HF/GGUF models, ONNX zoo, llamafile, embedding CLIs, ML tools that expose stdin/HTTP" },
  { field: 'retro/esoteric', hint: "esolang interpreters, bytebeat/one-liner music, demoscene tools, ANSI/teletext, dwarf-fortress-adjacent, weird VMs, uxn/varvara, teletext" },
  { field: 'filesystems/storage', hint: "unusual FUSE filesystems, litestream/restic-adjacent, content-addressed storage, dedup, tar/zip surgery, mount-anything tools" },
  { field: 'artifacts: lists/rules/grammars', hint: "NON-TOOL artifacts: DNS blocklists (StevenBlack/OISD/HaGeZi), wordlists (SecLists), YARA/Sigma/Semgrep rule repos, tree-sitter/ANTLR grammars, public-suffix/tzdata/Unicode data files. Record which glue form each exposes (newline text / pattern engine / parser / data file)." },
  { field: 'artifacts: models/fonts/assets/feeds', hint: "NON-TOOL artifacts: Nerd Fonts/icon sets, Kenney game assets/soundfonts/textures, open datasets (awesome-public-datasets), public feeds (OpenStreetMap, GTFS transit, NWS weather, arXiv, Wikidata, GDELT). Record the glue form (file to rasterize / CSV-Parquet-JSON to query / API/RSS stream)." },
]

// ---------- known-real hub tools (no need to verify; universal connective tissue) ----------
const HUB_TOOLS = "Known-real HUB TOOLS you may freely use as connective tissue (do not need to appear in the verified pool): jq, fzf, ripgrep(rg), pandoc, ffmpeg, imagemagick(magick), miller(mlr), dasel, yt-dlp, entr, watchexec, socat, croc, rclone, restic, litestream, duckdb, sqlite3, graphviz(dot), mermaid, caddy, tailscale, curl, awk, sed, xargs, exiftool, netcat(nc), tesseract."

// ================= SKIM =================
phase('Skim')
log(`Dispatching ${CELLS.length} read-only skimmers across the domain grid + artifact reservoirs`)

const skimResults = await parallel(CELLS.map((c) => () =>
  agent(
    `You are a fast READ-ONLY tool scout. FIELD: "${c.field}".
${WEB}
Focus areas / dense lists to mine: ${c.hint}
${SKEW}
${LEGIT}
Do NOT verify stars/license/commits and do NOT compose anything — just read and extract.
For every plausible tool/artifact extract: name, repo URL (best guess if not certain), one-line description, apparent glue (guess from description: stdin? json? http? sqlite? file? unknown ok), oddness 1-5, and the source page URL.
Return ONLY the structured candidates.`,
    { label: `skim:${c.field}`, phase: 'Skim', schema: SKIM_SCHEMA, model: 'claude-haiku-4-5', effort: 'low' }
  ).then((r) => ({ field: c.field, candidates: (r && r.candidates) || [] }))
))

// ---------- ORCHESTRATOR TRIAGE (plain JS: dedup + dense-domain cap) ----------
function repoKey(u) {
  if (!u) return ''
  return String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\.git$/, '')
}
const seen = new Map()
for (const block of skimResults.filter(Boolean)) {
  for (const cand of block.candidates) {
    if (!cand || !cand.name) continue
    const k = repoKey(cand.repo) || ('name:' + String(cand.name).toLowerCase().trim())
    const rec = { ...cand, field: cand.field || block.field }
    if (!seen.has(k)) seen.set(k, rec)
    else {
      const prev = seen.get(k)
      prev.oddness = Math.max(prev.oddness || 0, rec.oddness || 0)
    }
  }
}
const allCands = Array.from(seen.values())

// dense-domain discipline: cap per field, prefer higher oddness
const byField = new Map()
for (const c of allCands) {
  const f = c.field || 'unknown'
  if (!byField.has(f)) byField.set(f, [])
  byField.get(f).push(c)
}
const PER_FIELD_CAP = 3
let shortlist = []
for (const [f, arr] of byField) {
  arr.sort((a, b) => (b.oddness || 0) - (a.oddness || 0))
  shortlist.push(...arr.slice(0, PER_FIELD_CAP))
}
// global ceiling to keep verification lean
shortlist.sort((a, b) => (b.oddness || 0) - (a.oddness || 0))
const TOTAL_CAP = 54
shortlist = shortlist.slice(0, TOTAL_CAP)
log(`Skim complete: ${allCands.length} unique candidates across ${byField.size} fields -> shortlist of ${shortlist.length} for verification`)

// ================= VERIFY =================
phase('Verify')
function chunk(arr, n) {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}
const batches = chunk(shortlist, 4)
log(`Verifying shortlist in ${batches.length} batches`)

const verifyResults = await parallel(batches.map((b, i) => () =>
  agent(
    `You are a careful verifier. ${WEB}
For EACH candidate below, open its real repo/docs (WebFetch the repo URL; if it 404s or is a guess, WebSearch the tool name to find the canonical repo). Confirm and record:
- exists (true/false — set false if you cannot find a real repo/site)
- ~stars (e.g. "~2.3k" or "unknown"), license (SPDX or "unknown"), last_commit (YYYY-MM or "unknown")
- speaks: the glue it ACTUALLY exposes (correct the skimmer's guess) — stdin/stdout, jsonl, csv, http, sqlite, fuse, mcp, serial/mqtt, file, newline-text, pattern-engine, parser, data-file, etc.
- artifact_type: one of tool | gui-app | list/blocklist | dataset | model | font | icon/asset | firmware | emulator/core | ruleset | grammar | protocol | notation/dsl | public-feed
NEVER invent stars/license/flags — write "unknown" when unconfirmed. Drop nothing yourself; report exists:false for anything you cannot confirm and I will drop it.
Candidates (JSON):
${JSON.stringify(b)}
Return the upgraded verified records only.`,
    { label: `verify:batch-${i + 1}`, phase: 'Verify', schema: VERIFY_SCHEMA, model: 'claude-sonnet-5', effort: 'medium' }
  ).then((r) => (r && r.verified) || [])
))

const verifiedPool = verifyResults.filter(Boolean).flat().filter((t) => t && t.exists !== false)
// re-dedup after verification (workers may resolve two guesses to the same repo)
const vseen = new Map()
for (const t of verifiedPool) {
  const k = repoKey(t.repo) || ('name:' + String(t.name).toLowerCase().trim())
  if (!vseen.has(k)) vseen.set(k, t)
}
const pool = Array.from(vseen.values())
log(`Verified pool: ${pool.length} real tools/artifacts`)

// ================= COMPOSE =================
phase('Compose')
const poolJSONL = pool.map((t) => JSON.stringify({
  name: t.name, field: t.field, artifact_type: t.artifact_type, speaks: t.speaks, one_liner: t.one_liner, repo: t.repo,
})).join('\n')

const RUBRIC = `Score every chain 1-5 on: nonobvious(x3), emergence(x3), crossdomain(x2), payoff(x1), feasibility(x0.5). AUTO-REJECT anything <=2 on nonobvious OR emergence.
Run every chain through the Wild-but-Good filter: (1) emergence is real (a single tool/obvious script can't already do it), (2) the "so what" survives one skeptical question (name who it's for), (3) it's not novelty-from-friction (weirdness comes from ideas colliding, not pointless steps). verdict = good-wild | wildcard | dumb-wild.
Reject obvious pairings (nginx+certbot, ffmpeg-to-mp4, docker+compose). Real flags only — cite docs or say "see docs" rather than guessing syntax. Only use tools from the verified pool below or the hub-tools list; NO phantom tools. Label confidence verified|plausible|speculative.`

const MANDATES = [
  { key: 'cross-domain', ask: "Invent 5 chains. Prioritize pairs of tools whose native domains are FAR APART on the grid, and cross-domain repurposing (a tool used far outside its field). At least 4 of your 5 must repurpose a tool outside its intended domain." },
  { key: 'artifact-crossing', ask: "Invent 5 chains. EVERY one must pair a TOOL with a NON-TOOL ARTIFACT (a blocklist, dataset, font, model, firmware, grammar, ruleset, or public feed) so the artifact becomes fuel it was never meant for. Make the artifact's glue-form explicit." },
  { key: 'wildcards', ask: "Invent 5 chains and push emergence to the maximum. Include >=2 PURE WILDCARDS — astonishing, beautiful, or delightfully absurd even if barely practical (feasibility may be low). The other 3 must still be good-wild, not dumb-wild." },
  { key: 'hub-leverage', ask: "Invent 5 chains, each built as ONE hub tool + TWO specialized tools/artifacts, using the store-and-query, watcher-triggered, sidecar/daemonize, or agentify (expose-as-MCP) patterns. Emergence must be real, not just plumbing." },
]

const composed = await parallel(MANDATES.map((m) => () =>
  agent(
    `You are a composition savant with rare taste for the non-obvious. Here is a VERIFIED pool of obscure open-source tools/artifacts with confirmed interop primitives (JSONL):
${poolJSONL}

${HUB_TOOLS}

${m.ask}
${RUBRIC}
Give each chain a memorable name, explicit roles (source->transform->sink), the EXACT glue per hop (format/stream/API/socket/file), the emergent capability in one line, a concrete real-command sketch, the pattern from the taxonomy, domains bridged, the 5 rubric scores, verdict + reason, the fragile seam, and confidence.
Return chains only.`,
    { label: `compose:${m.key}`, phase: 'Compose', schema: COMPOSE_SCHEMA, model: 'claude-opus-4-8', effort: 'high' }
  ).then((r) => ((r && r.chains) || []).map((ch) => ({ ...ch, batch: m.key })))
))

const chains = composed.filter(Boolean).flat()
log(`Composed ${chains.length} candidate chains`)

return {
  stats: {
    unique_candidates: allCands.length,
    fields_covered: byField.size,
    shortlisted: shortlist.length,
    verified: pool.length,
    chains: chains.length,
  },
  verified_pool: pool,
  chains,
}

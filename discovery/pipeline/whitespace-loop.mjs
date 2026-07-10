export const meta = {
  name: 'whitespace-loop',
  description: 'Self-refining idea hunt: invent -> well-posedness gate -> adversarial prior-art -> refine; loop to a target of survivors',
  phases: [
    { title: 'Invent', detail: 'buildable would-be-novel repo ideas (AI/ML lean)', model: 'claude-opus-4-8' },
    { title: 'Gate', detail: 'well-posedness: name the seam, "valid" must be non-trivial, buildable v0', model: 'claude-sonnet-5' },
    { title: 'Refute', detail: 'two adversarial skeptics try to prove each idea already exists', model: 'claude-sonnet-5' },
    { title: 'Refine', detail: 'sharpen survivors into build specs; re-verify the sharpened claim', model: 'claude-opus-4-8' },
  ],
}

// ---------------- schemas ----------------
const IDEA_SCHEMA = { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: {
  name: { type: 'string' }, one_line: { type: 'string' }, domain: { type: 'string' },
  tools: { type: 'array', items: { type: 'string' } }, artifact_crossing: { type: 'boolean' },
  host_seam: { type: 'string' }, valid_nontrivial_why: { type: 'string' },
  build_sketch: { type: 'string' }, why_novel: { type: 'string' }, closest_existing_guess: { type: 'string' },
  buildability: { type: 'string' }, delight: { type: 'integer' }, utility: { type: 'integer' },
}, required: ['name', 'one_line', 'host_seam', 'build_sketch', 'why_novel', 'buildability'] } } }, required: ['ideas'] }

const GATE_SCHEMA = { type: 'object', properties: {
  idea_name: { type: 'string' }, seam_named: { type: 'boolean' }, valid_is_nontrivial: { type: 'boolean' },
  buildable_v0: { type: 'boolean' }, wellposed: { type: 'boolean' }, critique: { type: 'string' },
}, required: ['idea_name', 'wellposed', 'critique'] }

const PRIORART_SCHEMA = { type: 'object', properties: {
  idea_name: { type: 'string' }, exists: { type: 'string' },
  closest_prior_art: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, what_it_does: { type: 'string' } } },
  gap: { type: 'string' }, verdict_reason: { type: 'string' },
}, required: ['idea_name', 'exists', 'gap'] }

const REFINE_SCHEMA = { type: 'object', properties: {
  name: { type: 'string' }, tagline: { type: 'string' }, domain: { type: 'string' },
  host_seam: { type: 'string' }, tools: { type: 'array', items: { type: 'string' } },
  build_spec: { type: 'string' }, repo_layout: { type: 'string' },
  why_novel: { type: 'string' }, closest_prior_art: { type: 'string' }, differs_by: { type: 'string' },
  remaining_risk: { type: 'string' }, buildability: { type: 'string' }, delight: { type: 'integer' }, utility: { type: 'integer' },
  is_ai_ml: { type: 'boolean' },
}, required: ['name', 'tagline', 'host_seam', 'build_spec', 'why_novel', 'differs_by'] }

// ---------------- shared context ----------------
const WEB = "You have web access. FIRST call ToolSearch with 'select:WebSearch,WebFetch' to load web tools, then actually search — never answer from memory."
const VELATO_LESSON = `THE WELL-POSEDNESS LAW (learned the hard way): any idea of the form "interpret/run artifact X as program/data Y" MUST name its exact host language/semantics, and "valid / works / found" must be NON-TRIVIAL. Cautionary case: "run MIDI files as Brainfuck programs" is broken because Brainfuck ignores all non-command bytes, so EVERY file is trivially 'valid' and the result is meaningless. The strict version ("mine a corpus for files that compile under Velato, a strict music-as-source esolang") is well-posed. If you cannot state what makes an input non-trivially valid/interesting, the idea is under-specified and worthless.`
const TRAP = `PRIOR-ART TRAP: do NOT propose "use tool X to do capability Y" when field Y already has a native tool for Y (watershed-on-images, adversarial-steganalysis, binary-format-inference all already exist). Market-absence survives only where nobody had a REASON to build the thing.`
const AIM = `TARGET: ideas that are (a) plausibly MARKET-ABSENT and (b) BUILDABLE as a small public repo (weekend v0). Utility is a bonus, not required. Bias toward delightful "nobody's made that?!" artifacts. Name the host_seam and why 'valid' is non-trivial for EVERY idea.`
const PALETTE = `Composable OSS palette (real): CG-3, colibri-core, Morfessor, Nanocubes, TauDEM, SedonaDB, QuackOSM, jvarkit, smof, zindex, VapourSynth+mvtools, ImplicitCAD/LibFive, odexp, netsniff-ng, Schoenberg, Velato (strict MIDI-as-source esolang, rottytooth/Velato), Piet (image-as-source esolang), patat, Entangled, famfs, Venti, Pastvu, Justlog, dwarf2json.
Non-tool artifacts: DNS blocklists, SecLists wordlists, YARA/Sigma rules, tree-sitter/ANTLR grammars, Nerd Fonts + OpenType feature files, GTFS transit feeds, OpenStreetMap, Unicode UCD, public-suffix list, CMU pronouncing dict, WordNet, Lakh MIDI dataset, tzdata.
AI/ML models as local endpoints: whisper.cpp (STT), piper (TTS), silero-vad, llamafile, sherpa-onnx, ONNX zoo, CLIP/embedding models, RVC voice models, tesseract OCR + langdata.
Hubs: jq, awk, ffmpeg, imagemagick, sox, duckdb, sqlite, graphviz, pandoc, fontforge/fontTools, tesseract, gnuplot.`

const MANDATES = [
  { key: 'ai-artifact-crossings', ai: true, ask: "Invent 4 ideas where a LOCAL AI/ML MODEL is used as fuel in a context nobody had reason to try — a model driving a non-AI artifact, or a strange non-AI artifact driving a model. NOT 'another AI wrapper/agent/chatbot'. The crossing is the novelty. (AI/ML is a lean here, chase it.)" },
  { key: 'new-primitives', ai: false, ask: "Invent 4 NEW PRIMITIVES / new file-format / esolang-style artifacts or 'found-computation' harnesses (e.g. mine a corpus for files accidentally valid under a STRICT real language; rank by longest-valid-prefix). Name the strict host language explicitly." },
  { key: 'far-crossings', ai: false, ask: "Invent 4 ideas pairing maximally-distant domains (type technology x bioinformatics, transit feeds x audio synthesis, keyboard firmware x OSINT, fonts x vision models) where the crossing itself is the novelty." },
  { key: 'delight-toys', ai: false, ask: "Invent 4 pure-delight, weekend-buildable toys — the repo that hits HN's front page for being gloriously clever. Feasibility of a v0 in a weekend is required; still name the seam." },
]

const TARGET = 8
const MAX_ROUNDS = 2
const seedList = (typeof args !== 'undefined' && args && Array.isArray(args.seeds)) ? args.seeds : []

const seen = new Set()
const survivors = []
let round = 0

while (survivors.length < TARGET && round < MAX_ROUNDS) {
  round++
  log(`=== Round ${round} (have ${survivors.length}/${TARGET} survivors) ===`)

  // ---- INVENT ----
  phase('Invent')
  const seedNote = (round === 1 && seedList.length)
    ? `\nCARRY-FORWARD SEEDS from a prior round to also consider/improve (do not just repeat them — sharpen or leapfrog): ${JSON.stringify(seedList).slice(0, 1500)}` : ''
  const invented = await parallel(MANDATES.map((m) => () =>
    agent(`You are inventing genuinely NEW things to build as small open-source repos.
${AIM}
${TRAP}
${VELATO_LESSON}
${PALETTE}${seedNote}
Already proposed in earlier rounds (do NOT repeat): ${Array.from(seen).slice(0, 60).join('; ') || '(none yet)'}
${m.ask}
Return each idea with: name, one_line, domain, tools, artifact_crossing, host_seam (the exact semantics/host language), valid_nontrivial_why (why 'valid/works' is non-trivial), build_sketch (real commands/APIs or 'see docs'), why_novel, closest_existing_guess, buildability (afternoon|weekend|project), delight 1-5, utility 1-5.`,
      { label: `invent:${m.key}:r${round}`, phase: 'Invent', schema: IDEA_SCHEMA, model: 'claude-opus-4-8', effort: 'high' })
      .then((r) => ((r && r.ideas) || []).map((x) => ({ ...x, batch: m.key, ai_lean: m.ai })))
  ))
  let ideas = invented.filter(Boolean).flat().filter((it) => {
    const k = String(it.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
    if (!k || seen.has(k)) return false
    seen.add(k); return true
  }).slice(0, 14)
  log(`Round ${round}: ${ideas.length} fresh ideas`)
  if (!ideas.length) break

  // ---- GATE (well-posedness) ----
  phase('Gate')
  const gated = await parallel(ideas.map((idea) => () =>
    agent(`Judge whether this project idea is WELL-POSED. ${VELATO_LESSON}
Decide: seam_named (does it name its exact host language/semantics?), valid_is_nontrivial (is "valid/works/found" non-trivial, or would almost everything trivially qualify?), buildable_v0 (could a competent dev ship a v0 in <= a weekend?). wellposed = all three true. Be strict; a vague grand idea fails.
IDEA: name=${idea.name}; one_line=${idea.one_line}; host_seam=${idea.host_seam || '(none given)'}; why_valid_nontrivial=${idea.valid_nontrivial_why || '(none)'}; build_sketch=${idea.build_sketch}`,
      { label: `gate:${String(idea.name).slice(0, 20)}:r${round}`, phase: 'Gate', schema: GATE_SCHEMA, model: 'claude-sonnet-5', effort: 'medium' })
      .then((g) => ({ idea, gate: g }))
  ))
  const wellposed = gated.filter((x) => x && x.gate && x.gate.wellposed).map((x) => x.idea)
  log(`Round ${round}: ${wellposed.length}/${ideas.length} passed well-posedness gate`)

  // ---- REFUTE (adversarial prior-art, 2 skeptics) ----
  phase('Refute')
  const angles = [
    "find an existing tool/repo/product that already implements essentially this",
    "find any paper, Hacker News post, blog, or gist where someone described or demoed this",
  ]
  const refuted = await parallel(wellposed.map((idea) => () =>
    parallel(angles.map((angle, ai) => () =>
      agent(`Your job is to REFUTE the novelty of this idea. Be a skeptic. ${WEB}
Search AGGRESSIVELY from this angle: ${angle}. Run several distinct queries (capability, tool names, artifact crossing, likely project names).
Judge exists: "yes" = something already does essentially this; "partial" = a near-neighbor exists but a real gap remains; "no" = genuinely could not find anything close. Report closest_prior_art (name,url,what) and the precise gap. Default to "partial"/"yes" if unsure.
IDEA: name=${idea.name}; one_line=${idea.one_line}; host_seam=${idea.host_seam}; build=${idea.build_sketch}; author_novelty_claim=${idea.why_novel}`,
        { label: `refute:${String(idea.name).slice(0, 18)}#${ai + 1}:r${round}`, phase: 'Refute', schema: PRIORART_SCHEMA, model: 'claude-sonnet-5', effort: 'medium' })
    )).then((vs) => {
      const v = vs.filter(Boolean)
      const anyYes = v.some((x) => (x.exists || '').toLowerCase() === 'yes')
      const anyNo = v.some((x) => (x.exists || '').toLowerCase() === 'no')
      return { idea, verdicts: v, status: anyYes ? 'exists' : (anyNo ? 'white-space' : 'partial') }
    })
  ))
  const passed = refuted.filter((r) => r && (r.status === 'white-space' || r.status === 'partial'))
  log(`Round ${round}: ${passed.length} passed prior-art (of ${wellposed.length}); ${refuted.filter(r=>r&&r.status==='exists').length} already exist`)

  // ---- REFINE (Velato treatment: sharpen + re-verify) ----
  phase('Refine')
  const refined = await parallel(passed.map((r) => () =>
    agent(`Sharpen this surviving idea into a build-ready open-source project. ${WEB}
Do the "Velato treatment": (1) state the exact host_seam and why 'valid/works' is non-trivial, (2) write a concrete build_spec (architecture, key commands/APIs, real flags or 'see docs'), (3) a v0 repo_layout, (4) re-verify novelty of the SHARPENED claim with 1-2 quick searches and name closest_prior_art + exactly how this differs_by, (5) remaining_risk. Also set is_ai_ml, delight 1-5, utility 1-5, buildability.
IDEA: ${JSON.stringify({ name: r.idea.name, one_line: r.idea.one_line, host_seam: r.idea.host_seam, tools: r.idea.tools, build: r.idea.build_sketch, why_novel: r.idea.why_novel, prior_art_status: r.status, closest: r.verdicts.map(v => v.closest_prior_art).filter(Boolean) })}`,
      { label: `refine:${String(r.idea.name).slice(0, 20)}:r${round}`, phase: 'Refine', schema: REFINE_SCHEMA, model: 'claude-opus-4-8', effort: 'high' })
      .then((spec) => spec ? ({ ...spec, prior_art_status: r.status, batch: r.idea.batch, ai_lean: r.idea.ai_lean }) : null)
  ))
  for (const s of refined.filter(Boolean)) survivors.push(s)
  log(`Round ${round}: +${refined.filter(Boolean).length} refined survivors (total ${survivors.length})`)
}

// rank: white-space > partial, then delight*2 + utility + buildability
function rank(s) {
  const b = { afternoon: 3, weekend: 2, project: 1 }[(s.buildability || '').toLowerCase()] || 1
  return (s.prior_art_status === 'white-space' ? 6 : 0) + (s.delight || 0) * 2 + (s.utility || 0) + b
}
survivors.sort((a, b) => rank(b) - rank(a))

return {
  stats: { rounds: round, survivors: survivors.length, white_space: survivors.filter(s => s.prior_art_status === 'white-space').length, ai_ml: survivors.filter(s => s.is_ai_ml).length },
  survivors,
}

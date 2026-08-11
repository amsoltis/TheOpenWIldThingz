/**
 * Prompts bound to the Nvidia NIM microservice layer.
 *
 * Note the division of labour these encode. The model is never asked to invent
 * a route, a station, a line or a car position — the deterministic compiler has
 * already produced all of those from the transit authority's own schedule data.
 * The model's job is prose: taking a correct instruction and making it read
 * like a person telling you where to go. Every response is re-validated
 * afterwards, and any card that fails validation keeps its compiled text.
 */

export const NIM_SYSTEM_PROMPT = `You are the core structural data-shaping middleware component of the Plain-English Transit Application.
Your task is to consume raw metadata arrays representing New York City Subway stations, structural layout records, and live transit alert matrices, and convert them exclusively into clean, plain-English navigation steps for tourists.

CRITICAL INSTRUCTIONS FOR COMPUTATION LOGIC:
1. Strip out all technical transit jargon, raw coordinates, and compass vectors (North, South, East, West).
2. Translate directional indicators into distinct borough targets ("Towards Brooklyn") or local macro-landmarks ("Towards Central Park").
3. Isolate high-contrast visual identifiers (e.g., tile colors, specific commercial storefronts, structural columns, distinct overhead sign colors).
4. For platform navigation, you must explicitly call out co-located transit lines running on the same physical tracks and group them inside the 'coLocatedLinesToDim' configuration array.
5. If the raw alert matrix indicates track work, service suspension, or station bypass parameters for the target timestamp offset, you must flag 'isMaintenanceDiverted' as true, discard the standard configuration path, and build an alternate, explicit recovery routing track.
6. Absolute Constraint: You must output a valid, minified JSON object matching the requested schema. You are strictly forbidden from adding any markdown wrapping outside the JSON block, intro prose, or conversational postscripts.`;

/**
 * The rewrite pass.
 *
 * Constrained hard: the model receives one card's prose and returns one card's
 * prose. It is told explicitly that the facts are not its to change, because a
 * fluent instruction with an invented station name is more dangerous than a
 * stiff one with a correct name.
 */
export const NIM_POLISH_PROMPT = `You rewrite subway navigation instructions for tourists who are anxious, in a hurry, and do not know the city.

You will receive JSON with "primaryInstructionMarkdown" and "visualAnchors" for a single navigation card.

Rewrite them to be warmer and easier to follow at a glance. Rules:
- NEVER change or remove any station name, line letter/number, headsign, stop count, or car position. These are facts, not phrasing.
- NEVER introduce a station, line, or landmark that is not already in the input.
- NEVER use compass directions (north, south, east, west) or the words "uptown"/"downtown" unless quoting a sign already quoted in the input.
- Keep every **bold** span exactly as it appears in the input.
- Keep the first sentence short enough to read on a locked phone screen at arm's length.
- Keep the same number of visualAnchors entries, in the same order, each covering the same fact.

Output a minified JSON object with exactly the keys "primaryInstructionMarkdown" and "visualAnchors". No prose, no code fences.`;

/**
 * Location resolution for the "I Messed Up" flow.
 *
 * The model is handed a shortlist of real candidate stations and must pick from
 * it. It cannot name a station that is not on the list, which is what stops a
 * confident hallucination from being handed to somebody who is already lost.
 */
export const NIM_RECOVERY_PROMPT = `A lost traveller in the New York City subway has described what they can see around them. You will receive their description and a numbered shortlist of candidate stations, each with the lines that serve it.

Pick the single most likely candidate, or report that you cannot tell.

Rules:
- You may ONLY choose a station from the supplied shortlist, by its exact id.
- If the description does not clearly match one candidate, set "confidence" below 0.45 and supply "clarifyingQuestions": two or three short, concrete questions whose answers would disambiguate (things a person can read off a wall or a sign, never compass directions).
- "reasoningPlainText" must be one sentence a frightened tourist can check for themselves, naming the specific detail you matched on.

Output a minified JSON object with keys: "stationId" (string or null), "confidence" (0..1), "reasoningPlainText" (string), "clarifyingQuestions" (array of strings, may be empty). No prose, no code fences.`;

/** The response schema the spec binds to the microservice layer. */
export const TRANSIT_PACKET_JSON_SCHEMA = {
  $schema: 'https://json-schema.org',
  type: 'object',
  required: ['packetId', 'compiledAt', 'isMaintenanceDiverted', 'outboundJourney', 'returnJourney'],
  properties: {
    packetId: { type: 'string' },
    compiledAt: { type: 'string', format: 'date-time' },
    isMaintenanceDiverted: { type: 'boolean' },
    outboundJourney: { $ref: '#/defs/journeyLeg' },
    returnJourney: { $ref: '#/defs/journeyLeg' },
  },
  defs: {
    journeyLeg: {
      type: 'object',
      required: ['totalEstimatedDurationMinutes', 'initialStreetEntrance', 'navigationCards'],
      properties: {
        totalEstimatedDurationMinutes: { type: 'integer' },
        initialStreetEntrance: {
          type: 'object',
          required: ['entranceId', 'streetIntersectionText', 'geographicCornerCode', 'visualLandmarkCue'],
          properties: {
            entranceId: { type: 'string' },
            streetIntersectionText: { type: 'string' },
            geographicCornerCode: { type: 'string', enum: ['NW', 'NE', 'SW', 'SE'] },
            visualLandmarkCue: { type: 'string' },
            avoidanceWarningText: { type: 'string' },
          },
        },
        navigationCards: {
          type: 'array',
          items: {
            type: 'object',
            required: ['cardId', 'phaseOrder', 'phaseType', 'primaryInstructionMarkdown', 'visualAnchors'],
            properties: {
              cardId: { type: 'string' },
              phaseOrder: { type: 'integer' },
              phaseType: {
                type: 'string',
                enum: ['ENTRANCE_APPROACH', 'MEZZANINE_TRANSIT', 'PLATFORM_WAIT', 'ON_TRAIN', 'EXIT_SURFACING'],
              },
              primaryInstructionMarkdown: { type: 'string' },
              visualAnchors: { type: 'array', items: { type: 'string' } },
              criticalAvoidanceNotes: { type: 'string' },
              lineFocusConfig: {
                type: 'object',
                required: [
                  'activeLineId',
                  'activeLineColor',
                  'coLocatedLinesToDim',
                  'expectedTrainCarIndex',
                  'platformPositioningText',
                ],
                properties: {
                  activeLineId: { type: 'string' },
                  activeLineColor: { type: 'string' },
                  coLocatedLinesToDim: { type: 'array', items: { type: 'string' } },
                  expectedTrainCarIndex: { type: 'integer' },
                  platformPositioningText: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/** Schema for the constrained prose rewrite. */
export const POLISH_JSON_SCHEMA = {
  type: 'object',
  required: ['primaryInstructionMarkdown', 'visualAnchors'],
  additionalProperties: false,
  properties: {
    primaryInstructionMarkdown: { type: 'string' },
    visualAnchors: { type: 'array', items: { type: 'string' } },
  },
} as const;

/** Schema for constrained location resolution. */
export const RECOVERY_JSON_SCHEMA = {
  type: 'object',
  required: ['stationId', 'confidence', 'reasoningPlainText'],
  additionalProperties: false,
  properties: {
    stationId: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoningPlainText: { type: 'string' },
    clarifyingQuestions: { type: 'array', items: { type: 'string' } },
  },
} as const;

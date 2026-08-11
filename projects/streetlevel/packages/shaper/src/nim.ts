import type { JourneyLeg, RouteCard, TransitPacket } from '@streetlevel/shared';

import { containsCompassDirection } from './language.js';
import {
  NIM_POLISH_PROMPT,
  NIM_RECOVERY_PROMPT,
  POLISH_JSON_SCHEMA,
  RECOVERY_JSON_SCHEMA,
} from './prompts.js';

export interface NimConfig {
  enabled: boolean;
  /** OpenAI-compatible base, e.g. http://nim:8000/v1 for a local container. */
  baseUrl: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
}

export function nimConfigFromEnv(env: NodeJS.ProcessEnv = process.env): NimConfig {
  const baseUrl = env['NIM_BASE_URL']?.trim() ?? '';
  return {
    // Absence of a configured endpoint is a supported, first-class state: the
    // deterministic compiler alone produces a complete, correct packet.
    enabled: baseUrl.length > 0 && env['NIM_DISABLED'] !== '1',
    baseUrl,
    apiKey: env['NIM_API_KEY']?.trim() || undefined,
    model: env['NIM_MODEL']?.trim() || 'meta/llama-3.1-8b-instruct',
    timeoutMs: Number(env['NIM_TIMEOUT_MS'] ?? 4000),
  };
}

export interface NimRecoveryVerdict {
  stationId: string | null;
  confidence: number;
  reasoningPlainText: string;
  clarifyingQuestions: string[];
}

interface PolishPayload {
  primaryInstructionMarkdown: string;
  visualAnchors: string[];
}

function boldSpans(text: string): string[] {
  return [...text.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]!);
}

function integers(text: string): string[] {
  return [...text.matchAll(/\d+/g)].map((m) => m[0]);
}

/**
 * The gate every model rewrite must pass.
 *
 * The model is being asked to improve wording on an instruction that is already
 * correct, so the only interesting question is whether it changed anything it
 * was not supposed to. Anything that fails here silently keeps the compiled
 * text — a stiff correct sentence beats a fluent wrong one when the reader is
 * underground and cannot check.
 */
export function isSafeRewrite(original: PolishPayload, rewritten: PolishPayload): boolean {
  if (!rewritten.primaryInstructionMarkdown?.trim()) return false;
  if (!Array.isArray(rewritten.visualAnchors)) return false;
  if (rewritten.visualAnchors.length !== original.visualAnchors.length) return false;
  if (rewritten.visualAnchors.some((a) => typeof a !== 'string' || !a.trim())) return false;

  const originalAll = [original.primaryInstructionMarkdown, ...original.visualAnchors].join(' ');
  const rewrittenAll = [rewritten.primaryInstructionMarkdown, ...rewritten.visualAnchors].join(' ');

  // Station names and line bullets are bolded by the compiler precisely so they
  // can be checked for survival here.
  const originalBold = boldSpans(originalAll);
  const rewrittenBold = new Set(boldSpans(rewrittenAll));
  if (originalBold.some((span) => !rewrittenBold.has(span))) return false;

  // Stop counts and car positions are load-bearing numbers.
  const rewrittenInts = new Set(integers(rewrittenAll));
  if (integers(originalAll).some((n) => !rewrittenInts.has(n))) return false;

  if (!containsCompassDirection(originalAll) && containsCompassDirection(rewrittenAll)) return false;
  if (rewrittenAll.length > originalAll.length * 2.5) return false;

  return true;
}

export class NimClient {
  constructor(private readonly config: NimConfig) {}

  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * One constrained JSON call. Returns null on any failure — a timeout, a
   * refusal, malformed JSON, a 500 from the container. Callers treat null as
   * "keep what you had", never as an error worth failing a request over.
   */
  private async chatJson<T>(system: string, user: string, schema: object): Promise<T | null> {
    if (!this.config.enabled) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.2,
          max_tokens: 900,
          // Structured-output support differs across NIM builds; both spellings
          // are sent so a container honouring either one constrains generation,
          // and the response is validated regardless.
          response_format: { type: 'json_schema', json_schema: { name: 'response', schema } },
          nvext: { guided_json: schema },
        }),
        signal: controller.signal,
      });

      if (!res.ok) return null;
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) return null;

      // Some builds still wrap JSON in a fence despite instructions.
      const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Rewrites one card's prose, or returns it untouched. */
  async polishCard(card: RouteCard): Promise<RouteCard> {
    const original: PolishPayload = {
      primaryInstructionMarkdown: card.primaryInstructionMarkdown,
      visualAnchors: card.visualAnchors,
    };
    const result = await this.chatJson<PolishPayload>(
      NIM_POLISH_PROMPT,
      JSON.stringify({ phaseType: card.phaseType, ...original }),
      POLISH_JSON_SCHEMA,
    );
    if (!result || !isSafeRewrite(original, result)) return card;
    return {
      ...card,
      primaryInstructionMarkdown: result.primaryInstructionMarkdown,
      visualAnchors: result.visualAnchors,
    };
  }

  async polishLeg(leg: JourneyLeg): Promise<JourneyLeg> {
    if (!this.config.enabled) return leg;
    const cards = await Promise.all(leg.navigationCards.map((c) => this.polishCard(c)));
    return { ...leg, navigationCards: cards };
  }

  async polishPacket(packet: TransitPacket): Promise<TransitPacket> {
    if (!this.config.enabled) return packet;
    const [outboundJourney, returnJourney] = await Promise.all([
      this.polishLeg(packet.outboundJourney),
      this.polishLeg(packet.returnJourney),
    ]);
    return { ...packet, outboundJourney, returnJourney };
  }

  /**
   * Picks a station from a supplied shortlist. The shortlist is the safety
   * mechanism: the model physically cannot return a station that does not
   * exist, because anything off the list is rejected here.
   */
  async resolveStation(
    description: string,
    candidates: { id: string; name: string; lines: string[] }[],
  ): Promise<NimRecoveryVerdict | null> {
    if (!this.config.enabled || candidates.length === 0) return null;

    const shortlist = candidates
      .map((c, i) => `${i + 1}. id=${c.id} | ${c.name} | lines: ${c.lines.join(', ')}`)
      .join('\n');

    const verdict = await this.chatJson<NimRecoveryVerdict>(
      NIM_RECOVERY_PROMPT,
      `Traveller's description:\n"""${description}"""\n\nCandidate stations:\n${shortlist}`,
      RECOVERY_JSON_SCHEMA,
    );
    if (!verdict) return null;

    const allowed = new Set(candidates.map((c) => c.id));
    if (verdict.stationId !== null && !allowed.has(verdict.stationId)) return null;

    const confidence = Number(verdict.confidence);
    return {
      stationId: verdict.stationId,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
      reasoningPlainText: typeof verdict.reasoningPlainText === 'string' ? verdict.reasoningPlainText : '',
      clarifyingQuestions: Array.isArray(verdict.clarifyingQuestions)
        ? verdict.clarifyingQuestions.filter((q): q is string => typeof q === 'string')
        : [],
    };
  }
}

import type { StreetEntranceNode } from '@streetlevel/shared';

export type CornerCode = StreetEntranceNode['geographicCornerCode'];

export interface IntersectionNames {
  /** The street the entrance is on. */
  primaryStreet: string;
  /** The street it crosses. Empty when the packet gave us a single name. */
  crossStreet: string;
}

const SEPARATOR = /\s+(?:at|and|&|x|×)\s+/i;

/**
 * `streetIntersectionText` arrives as free prose — "7 Av at W 42 St",
 * "Broadway & W 42 St", "E 42 St/Lexington Av". The entrance diagram labels two
 * crossing bars, so it needs the two names apart. When we cannot split it we
 * label the one bar we are sure of rather than inventing a second street name:
 * a wrong street name on a corner diagram sends someone to the wrong block.
 */
export function splitIntersection(text: string): IntersectionNames {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { primaryStreet: '', crossStreet: '' };

  const bySeparator = trimmed.split(SEPARATOR);
  if (bySeparator.length >= 2) {
    return {
      primaryStreet: (bySeparator[0] ?? '').trim(),
      crossStreet: (bySeparator[1] ?? '').trim(),
    };
  }

  const bySlash = trimmed.split('/');
  if (bySlash.length >= 2) {
    return {
      primaryStreet: (bySlash[0] ?? '').trim(),
      crossStreet: (bySlash[1] ?? '').trim(),
    };
  }

  return { primaryStreet: trimmed, crossStreet: '' };
}

export interface CornerQuadrant {
  isNorth: boolean;
  isWest: boolean;
}

export function cornerQuadrant(code: CornerCode): CornerQuadrant {
  return { isNorth: code.startsWith('N'), isWest: code.endsWith('W') };
}

const CORNER_WORDS: Record<CornerCode, string> = {
  NW: 'north-west',
  NE: 'north-east',
  SW: 'south-west',
  SE: 'south-east',
};

export function cornerPlainName(code: CornerCode): string {
  return CORNER_WORDS[code];
}

export const ALL_CORNER_CODES: readonly CornerCode[] = ['NW', 'NE', 'SW', 'SE'];

/**
 * The sentence under the diagram. Tourists do not navigate by compass point in
 * a city they have never been to, so the corner word is always paired with the
 * two street names they can physically read on the sign post.
 */
export function cornerDescription(code: CornerCode, intersectionText: string): string {
  const { primaryStreet, crossStreet } = splitIntersection(intersectionText);
  const corner = cornerPlainName(code);
  if (crossStreet.length === 0) {
    return `The ${corner} corner of ${primaryStreet}.`;
  }
  return `The ${corner} corner, where ${primaryStreet} crosses ${crossStreet}.`;
}

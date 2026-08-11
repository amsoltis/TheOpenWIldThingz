import { describe, expect, it } from 'vitest';

import { RECOVERY_CONFIDENCE_FLOOR } from '@streetlevel/shared';

import { confidenceFromRanking } from './recover.js';
import { cameraClarifications, matchSign, readSign, type RecognisedLine } from './sign-text.js';

/**
 * Fixtures are shaped the way an on-device recogniser actually returns text:
 * fragments in no useful order, shouty, with the line bullets arriving as
 * isolated single glyphs rather than as part of a sentence.
 */
const line = (text: string, confidence?: number): RecognisedLine =>
  confidence === undefined ? { text } : { text, confidence };

describe('readSign', () => {
  it('separates the bullets from the words', () => {
    const reading = readSign([
      line('EASTERN PKWY'),
      line('BROOKLYN MUSEUM'),
      line('2'),
      line('3'),
      line('4'),
    ]);
    expect(reading.bullets).toEqual(['2', '3', '4']);
    expect(reading.query).toBe('EASTERN PKWY BROOKLYN MUSEUM');
  });

  it('drops fragments the recogniser was not confident about', () => {
    const reading = readSign([line('BEDFORD AV', 0.94), line('rnnnn', 0.08)]);
    expect(reading.query).toBe('BEDFORD AV');
    expect(reading.discarded).toEqual(['rnnnn']);
  });

  it('treats missing confidence as unknown rather than bad', () => {
    // Not every platform reports a score, and dropping unscored text would
    // throw away the whole photo on those devices.
    expect(readSign([line('BEDFORD AV')]).query).toBe('BEDFORD AV');
  });

  it('ignores a glyph that is not a line', () => {
    const reading = readSign([line('K'), line('%'), line('CANAL ST')]);
    expect(reading.bullets).toEqual([]);
    expect(reading.query).toContain('CANAL ST');
  });

  it('offers a digit reading of letters a recogniser confuses', () => {
    const reading = readSign([line('Z3 ST')]);
    expect(reading.digitVariant).toBe('23 5T');
  });
});

describe('matchSign', () => {
  it('identifies a station from the name on the wall', () => {
    const match = matchSign([line('BEDFORD AV'), line('L')]);
    expect(match.candidates[0]!.name).toBe('Bedford Av');
    expect(confidenceFromRanking(match.candidates)).toBeGreaterThanOrEqual(RECOVERY_CONFIDENCE_FLOOR);
  });

  it('uses the bullets to pick between stations that share a name', () => {
    // Four stations are called "23 St". The bullets are what separate them, and
    // on a sign an isolated glyph is unambiguously a bullet.
    const withBullets = matchSign([line('23 ST'), line('C'), line('E')]);
    const winner = withBullets.candidates[0]!;
    expect(winner.name).toContain('23 St');
    expect(winner.lines).toEqual(expect.arrayContaining(['C', 'E']));
  });

  it('recovers a misread name by resolving glyph confusions', () => {
    // "23 St" misrecognised as "Z3 ST" matches nothing as read.
    const match = matchSign([line('Z3 ST'), line('6')]);
    expect(match.usedVariant).toBe('DIGITS_RESOLVED');
    expect(match.candidates[0]!.name).toContain('23 St');
  });

  it('prefers the text as read when substituting glyphs gains nothing', () => {
    // A guess must never beat the evidence on equal scores.
    const match = matchSign([line('BEDFORD AV')]);
    expect(match.usedVariant).toBe('AS_READ');
  });

  it('stays unsure about a name shared by several stations with no bullets', () => {
    const match = matchSign([line('23 ST')]);
    expect(confidenceFromRanking(match.candidates)).toBeLessThan(RECOVERY_CONFIDENCE_FLOOR);
  });

  it('returns nothing rather than guessing from an unreadable photo', () => {
    const match = matchSign([line('xxxx', 0.05)]);
    expect(match.candidates).toHaveLength(0);
    expect(confidenceFromRanking(match.candidates)).toBe(0);
  });
});

describe('cameraClarifications', () => {
  it('asks for a different photo when nothing was legible', () => {
    const match = matchSign([line('zzz', 0.02)]);
    const asks = cameraClarifications(match).join(' ');
    expect(asks).toMatch(/could not read/i);
    expect(asks).toMatch(/blur/i);
  });

  it('asks for the bullets when the name alone is ambiguous', () => {
    const match = matchSign([line('23 ST')]);
    const asks = cameraClarifications(match).join(' ');
    // A camera user can be asked to point it somewhere else, which is a far
    // easier instruction than "describe your surroundings".
    expect(asks).toMatch(/coloured circles/i);
    expect(asks).toMatch(/23 St/);
  });
});

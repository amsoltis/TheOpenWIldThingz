import { describe, expect, it } from 'vitest';

import type { RouteCard } from './contract.js';
import { PROFICIENCY_ORDER } from './contract.js';
import { nextProficiency, renderForProficiency } from './proficiency.js';

function card(overrides: Partial<RouteCard> = {}): RouteCard {
  return {
    cardId: 'c1',
    phaseOrder: 3,
    phaseType: 'PLATFORM_WAIT',
    primaryInstructionMarkdown: 'Wait here for the **3** train toward **New Lots Av**.',
    conciseInstructionMarkdown: '**3** toward **New Lots Av**.',
    visualAnchors: [
      'The front of the train reads "New Lots Av".',
      'Platform signs show the 3 bullet.',
      'The 1 and 2 stop here too and are the same red as yours.',
    ],
    criticalAvoidanceNotes: 'Do not board the first train unless its front sign reads "New Lots Av".',
    ...overrides,
  };
}

describe('renderForProficiency', () => {
  it('shows a first-timer everything, with the scaffolding', () => {
    const rendered = renderForProficiency(card(), 'FIRST_TIME');
    expect(rendered.instruction).toMatch(/Wait here/);
    expect(rendered.anchors).toHaveLength(3);
    expect(rendered.showScaffolding).toBe(true);
  });

  it('trims a returning traveller to the instruction and the key detail', () => {
    const rendered = renderForProficiency(card(), 'BEEN_HERE');
    expect(rendered.instruction).toMatch(/Wait here/);
    expect(rendered.anchors).toHaveLength(2);
    // The compiler orders anchors by usefulness, so truncation must drop the
    // nice-to-know and keep the front-of-train check.
    expect(rendered.anchors[0]).toMatch(/front of the train/);
    expect(rendered.showScaffolding).toBe(false);
  });

  it('gives a local the line and the direction and nothing else', () => {
    const rendered = renderForProficiency(card(), 'LOCAL');
    expect(rendered.instruction).toBe('**3** toward **New Lots Av**.');
    expect(rendered.anchors).toHaveLength(0);
    expect(rendered.showScaffolding).toBe(false);
  });

  it('never drops the prohibition, at any level', () => {
    // A local boards the wrong train precisely because they stopped reading.
    for (const level of PROFICIENCY_ORDER) {
      expect(renderForProficiency(card(), level).avoidance).toMatch(/Do not board/);
    }
  });

  it('falls back to the full instruction when no concise one was compiled', () => {
    const bare = card({ conciseInstructionMarkdown: undefined });
    expect(renderForProficiency(bare, 'LOCAL').instruction).toMatch(/Wait here/);
  });

  it('ignores a blank concise instruction rather than showing an empty card', () => {
    const blank = card({ conciseInstructionMarkdown: '   ' });
    expect(renderForProficiency(blank, 'LOCAL').instruction).toMatch(/Wait here/);
  });

  it('keeps the line and the destination in every level of prose', () => {
    // Whatever else is trimmed, the two facts that decide whether they board
    // the right train have to survive.
    for (const level of PROFICIENCY_ORDER) {
      const { instruction } = renderForProficiency(card(), level);
      expect(instruction).toContain('3');
      expect(instruction).toContain('New Lots Av');
    }
  });
});

describe('nextProficiency', () => {
  it('cycles through every level and back', () => {
    const seen = [nextProficiency('FIRST_TIME'), nextProficiency('BEEN_HERE'), nextProficiency('LOCAL')];
    expect(seen).toEqual(['BEEN_HERE', 'LOCAL', 'FIRST_TIME']);
  });
});

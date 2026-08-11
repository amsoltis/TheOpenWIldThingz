import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LineID, RouteCard, StopLadder } from '@streetlevel/shared';
import { LINE_COLORS, LINE_TEXT_COLORS } from '@streetlevel/shared';

/**
 * Three points of view on the same two cards.
 *
 * Deliberately kept out of `mobile/` — nothing here is wired into the app. The
 * argument about how this product should look was going in circles in prose, so
 * these exist to be pointed at. Whichever one survives gets built properly; the
 * other two get deleted.
 *
 * All three render the same compiled packet, so any difference on screen is a
 * design difference and not a data one.
 */

export interface CardData {
  line: LineID;
  headsign: string;
  instruction: string;
  dimmed: LineID[];
  ladder: StopLadder;
  stopCount: number;
  destination: string;
  step: string;
}

export function cardDataFrom(platform: RouteCard, onTrain: RouteCard, destination: string): CardData {
  const focus = platform.targetLineFocus!;
  return {
    line: focus.activeLineId,
    headsign: /reads "([^"]+)"/.exec(platform.visualAnchors.join(' '))?.[1] ?? '',
    instruction: platform.primaryInstructionMarkdown.replace(/\*\*/g, ''),
    dimmed: focus.coLocatedLinesToDim,
    ladder: onTrain.stopLadder!,
    stopCount: (onTrain.stopLadder?.stops.length ?? 1) - 1,
    destination,
    step: '3',
  };
}

/* ================================================================== *
 * A — BULLET
 *
 * The line colour is not an accent, it is the room. A traveller looking for
 * the 3 is looking for a red circle; the screen becomes that circle. Type is
 * set the way the Transit Authority set it — one weight, tight, left-ranged on
 * a hard grid — and the chrome is a five-segment rail rather than a stack of
 * buttons.
 * ================================================================== */

export function BulletPlatform({ data }: { data: CardData }): ReactElement {
  const field = LINE_COLORS[data.line];
  const ink = LINE_TEXT_COLORS[data.line];

  return (
    <View style={[a.root, { backgroundColor: field }]}>
      <View style={a.topRow}>
        <Text style={[a.kicker, { color: ink }]}>WAITING FOR YOUR TRAIN</Text>
        <Text style={[a.kicker, { color: ink, opacity: 0.7 }]}>{data.step} / 5</Text>
      </View>

      {/* Bleeding off the right edge on purpose: the bullet is the subject of
          the screen, not an icon sitting inside a layout. */}
      <View style={a.bulletWrap}>
        <View style={[a.bullet, { backgroundColor: ink }]}>
          <Text style={[a.bulletGlyph, { color: field }]}>{data.line}</Text>
        </View>
      </View>

      <Text style={[a.headline, { color: ink }]}>WAIT{'\n'}HERE</Text>
      <Text style={[a.sub, { color: ink }]}>for the {data.line} toward</Text>
      <Text style={[a.headsign, { color: ink }]}>{data.headsign}</Text>

      <View style={a.plate}>
        <Text style={a.plateText}>{data.headsign.toUpperCase()}</Text>
        <View style={a.plateArrow} />
      </View>

      {data.dimmed.length > 0 ? (
        <View style={a.alsoRow}>
          {data.dimmed.map((l) => (
            <View key={l} style={[a.ghostBullet, { borderColor: ink }]}>
              <Text style={[a.ghostGlyph, { color: ink }]}>{l}</Text>
            </View>
          ))}
          <Text style={[a.alsoText, { color: ink }]}>
            SAME COLOUR AS YOURS.{'\n'}READ THE NUMBER.
          </Text>
        </View>
      ) : null}

      <View style={a.rail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[a.railSeg, { backgroundColor: ink, opacity: i <= 2 ? 1 : 0.3 }]} />
        ))}
      </View>
    </View>
  );
}

export function BulletTrain({ data }: { data: CardData }): ReactElement {
  const field = LINE_COLORS[data.line];
  const ink = LINE_TEXT_COLORS[data.line];
  const stops = data.ladder.stops;

  return (
    <View style={[a.root, { backgroundColor: field }]}>
      <View style={a.topRow}>
        <Text style={[a.kicker, { color: ink }]}>ON THE TRAIN</Text>
        <Text style={[a.kicker, { color: ink, opacity: 0.7 }]}>4 / 5</Text>
      </View>

      <Text style={[a.countGlyph, { color: ink }]}>{data.stopCount}</Text>
      <Text style={[a.countLabel, { color: ink }]}>STOPS{'\n'}TO GO</Text>

      <View style={a.getOff}>
        <Text style={[a.getOffLabel, { color: ink, opacity: 0.75 }]}>GET OFF AT</Text>
        <Text style={[a.getOffName, { color: ink }]}>{stops[stops.length - 1]}</Text>
      </View>

      <View style={[a.nextRule, { backgroundColor: ink }]} />
      <Text style={[a.nextLabel, { color: ink, opacity: 0.75 }]}>NEXT</Text>
      <Text style={[a.nextName, { color: ink }]}>{stops[1]}</Text>

      <View style={a.rail}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[a.railSeg, { backgroundColor: ink, opacity: i <= 3 ? 1 : 0.3 }]} />
        ))}
      </View>
    </View>
  );
}

const a = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28, paddingTop: 56, overflow: 'hidden' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  // Bleeds off the right edge; the headline is width-limited so the circle
  // overlaps empty field rather than eating a word.
  bulletWrap: { position: 'absolute', right: -68, top: 128 },
  bullet: { width: 226, height: 226, borderRadius: 113, alignItems: 'center', justifyContent: 'center' },
  bulletGlyph: { fontSize: 140, fontWeight: '800', letterSpacing: -6, includeFontPadding: false, marginLeft: -34 },
  headline: { fontSize: 82, fontWeight: '800', letterSpacing: -4.5, lineHeight: 76, marginTop: 74, maxWidth: 232 },
  sub: { fontSize: 20, fontWeight: '600', marginTop: 24, opacity: 0.85 },
  headsign: { fontSize: 34, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  plate: {
    backgroundColor: '#0B0B0B',
    marginTop: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateText: { color: '#FFFFFF', fontSize: 23, fontWeight: '700', letterSpacing: -0.4 },
  plateArrow: {
    width: 0,
    height: 0,
    borderTopWidth: 11,
    borderBottomWidth: 11,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  alsoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 26 },
  ghostBullet: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 8, opacity: 0.55,
  },
  ghostGlyph: { fontSize: 19, fontWeight: '800' },
  alsoText: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, lineHeight: 17, marginLeft: 10 },
  rail: { position: 'absolute', left: 28, right: 28, bottom: 34, flexDirection: 'row' },
  railSeg: { flex: 1, height: 4, marginRight: 5 },
  countGlyph: { fontSize: 250, fontWeight: '800', letterSpacing: -16, lineHeight: 230, marginTop: 16, includeFontPadding: false },
  countLabel: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34, marginTop: -6 },
  getOff: { marginTop: 44 },
  getOffLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  getOffName: { fontSize: 33, fontWeight: '800', letterSpacing: -1, lineHeight: 37, marginTop: 4 },
  nextRule: { height: 2, marginTop: 26, opacity: 0.35 },
  nextLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6, marginTop: 14 },
  nextName: { fontSize: 22, fontWeight: '700', marginTop: 2 },
});

/* ================================================================== *
 * B — DIAGRAM
 *
 * Vignelli's 1972 map, turned upright and made the interface. The journey runs
 * down the left as a real diagram — 45° kinks, station dots, your position an
 * open ring — and the words sit beside it. Navigation is the drawing, not a
 * control below the drawing.
 * ================================================================== */

export function DiagramPlatform({ data }: { data: CardData }): ReactElement {
  const c = LINE_COLORS[data.line];
  return (
    <View style={b.root}>
      <View style={b.spine}>
        <View style={[b.spineLine, { backgroundColor: c, top: 0, height: 150 }]} />
        <View style={[b.spineKink, { backgroundColor: c }]} />
        <View style={[b.spineLine, { backgroundColor: c, top: 196, bottom: 0 }]} />
        <View style={[b.here, { borderColor: c }]} />
        {[300, 380, 460, 540, 620, 700].map((t) => (
          <View key={t} style={[b.dot, { top: t }]} />
        ))}
      </View>

      <View style={b.body}>
        <Text style={b.kicker}>WAITING FOR YOUR TRAIN</Text>
        <Text style={b.headline}>Wait here for the {data.line}</Text>
        <Text style={b.toward}>toward {data.headsign}</Text>

        <View style={b.factRow}>
          <View style={[b.bullet, { backgroundColor: c }]}>
            <Text style={[b.bulletGlyph, { color: LINE_TEXT_COLORS[data.line] }]}>{data.line}</Text>
          </View>
          <Text style={b.factText}>
            The front of the train reads{'\n'}
            <Text style={b.factStrong}>{data.headsign}</Text>
          </Text>
        </View>

        {data.dimmed.length > 0 ? (
          <View style={b.warn}>
            <Text style={b.warnText}>
              The {data.dimmed.join(' and ')} are the same red. Read the number, not the colour.
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={b.hint}>swipe to continue</Text>
    </View>
  );
}

export function DiagramTrain({ data }: { data: CardData }): ReactElement {
  const c = LINE_COLORS[data.line];
  const stops = data.ladder.stops.slice(0, 7);
  const passed = data.ladder.passedThrough ?? {};

  return (
    <View style={b.root}>
      <View style={b.body2}>
        <Text style={b.kicker}>ON THE TRAIN · {data.stopCount} STOPS</Text>
        <Text style={b.headline}>Get off at{'\n'}{data.ladder.stops[data.ladder.stops.length - 1]}</Text>

        <View style={b.ladder}>
          <View style={[b.ladderSpine, { backgroundColor: c }]} />
          {stops.map((name, i) => (
            <View key={name + i} style={b.ladderRow}>
              <View style={[i === 0 ? b.nodeHere : b.node, i === 0 ? { borderColor: c } : null]} />
              <View style={b.ladderText}>
                <Text style={[b.stopName, i === 0 ? b.stopNameHere : null]}>{name}</Text>
                {passed[String(i)] ? (
                  <Text style={b.passed}>{passed[String(i)]!.join(' · ')} — does not stop</Text>
                ) : null}
              </View>
            </View>
          ))}
          <Text style={b.more}>… {data.ladder.stops.length - stops.length} more</Text>
        </View>
      </View>
      <Text style={b.hint}>swipe to continue</Text>
    </View>
  );
}

const b = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08080A', flexDirection: 'row' },
  spine: { width: 92, position: 'relative' },
  spineLine: { position: 'absolute', left: 40, width: 12 },
  spineKink: {
    position: 'absolute', left: 40, top: 142, width: 12, height: 62,
    transform: [{ rotate: '-38deg' }],
  },
  here: {
    position: 'absolute', left: 30, top: 232, width: 32, height: 32,
    borderRadius: 16, borderWidth: 6, backgroundColor: '#08080A',
  },
  dot: {
    position: 'absolute', left: 38, width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#08080A', borderWidth: 3, borderColor: '#5A5A62',
  },
  body: { flex: 1, paddingTop: 64, paddingRight: 30 },
  body2: { flex: 1, paddingTop: 64, paddingHorizontal: 30 },
  kicker: { color: '#6E6E78', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  headline: { color: '#FFFFFF', fontSize: 36, fontWeight: '700', letterSpacing: -1.1, lineHeight: 41, marginTop: 16 },
  toward: { color: '#B7B7C0', fontSize: 21, fontWeight: '500', marginTop: 10 },
  factRow: { flexDirection: 'row', alignItems: 'center', marginTop: 40 },
  bullet: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  bulletGlyph: { fontSize: 31, fontWeight: '800' },
  factText: { color: '#8E8E98', fontSize: 15, lineHeight: 21, marginLeft: 16, flexShrink: 1 },
  factStrong: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
  warn: { marginTop: 34, borderLeftWidth: 3, borderLeftColor: '#FF453A', paddingLeft: 14 },
  warnText: { color: '#E8E8EE', fontSize: 15, lineHeight: 22 },
  hint: { position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center', color: '#4A4A54', fontSize: 12, letterSpacing: 1.4 },
  ladder: { marginTop: 34, position: 'relative' },
  ladderSpine: { position: 'absolute', left: 9, top: 8, bottom: 30, width: 6 },
  ladderRow: { flexDirection: 'row', marginBottom: 20 },
  node: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#08080A', borderWidth: 3, borderColor: '#8E8E98', marginTop: 3, marginLeft: 5 },
  nodeHere: { width: 24, height: 24, borderRadius: 12, borderWidth: 6, backgroundColor: '#08080A', marginLeft: 0 },
  ladderText: { marginLeft: 18, flexShrink: 1 },
  stopName: { color: '#C9C9D2', fontSize: 17, fontWeight: '600' },
  stopNameHere: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  passed: { color: '#55555E', fontSize: 12, marginTop: 3 },
  more: { color: '#55555E', fontSize: 13, marginLeft: 32 },
});

/* ================================================================== *
 * C — PAPER
 *
 * Rejects the dark-app default outright. Ink on warm paper, the way a good
 * guidebook or a departure board reads: the contrast is higher than anything
 * black-on-black achieves, and the line colour becomes precious because it is
 * the only colour on the page.
 * ================================================================== */

export function PaperPlatform({ data }: { data: CardData }): ReactElement {
  const c = LINE_COLORS[data.line];
  return (
    <View style={p.root}>
      <View style={p.headRule} />
      <Text style={p.kicker}>WAITING FOR YOUR TRAIN · STEP {data.step} OF 5</Text>

      <Text style={p.headline}>Wait here for{'\n'}the {data.line} train.</Text>

      <View style={p.bulletRow}>
        <View style={[p.bullet, { backgroundColor: c }]}>
          <Text style={[p.bulletGlyph, { color: LINE_TEXT_COLORS[data.line] }]}>{data.line}</Text>
        </View>
        <View style={p.towardBlock}>
          <Text style={p.towardLabel}>TOWARD</Text>
          <Text style={p.towardName}>{data.headsign}</Text>
        </View>
      </View>

      <View style={p.rule} />

      <Text style={p.body}>
        The front of the train reads <Text style={p.bold}>{data.headsign}</Text>. Do not board the
        first train that arrives unless its sign says so.
      </Text>

      {data.dimmed.length > 0 ? (
        <>
          <View style={p.rule} />
          <Text style={p.caption}>
            THE {data.dimmed.join(' AND ')} STOP HERE TOO — AND ARE THE SAME RED AS YOURS.
            READ THE NUMBER, NOT THE COLOUR.
          </Text>
        </>
      ) : null}

      <View style={p.footer}>
        <Text style={p.footerText}>SWIPE FOR THE NEXT STEP</Text>
        <View style={p.footerDots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[p.footerDot, i === 2 ? { backgroundColor: '#14110E' } : null]} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function PaperTrain({ data }: { data: CardData }): ReactElement {
  const c = LINE_COLORS[data.line];
  const stops = data.ladder.stops;
  const passed = data.ladder.passedThrough ?? {};

  return (
    <View style={p.root}>
      <View style={p.headRule} />
      <Text style={p.kicker}>ON THE TRAIN · STEP 4 OF 5</Text>

      <Text style={p.headline}>
        {data.stopCount} stops,{'\n'}then get off.
      </Text>

      <View style={p.rule} />

      <View style={p.list}>
        {stops.slice(0, 5).map((name, i) => (
          <View key={name + i} style={p.listRow}>
            <Text style={[p.listNum, i === 0 ? { color: c } : null]}>
              {i === 0 ? '—' : String(i)}
            </Text>
            <View style={p.listBody}>
              <Text style={[p.listName, i === 0 ? p.listNameHere : null]}>{name}</Text>
              {passed[String(i)] ? (
                <Text style={p.listPassed}>passes {passed[String(i)]!.join(', ')} without stopping</Text>
              ) : null}
            </View>
          </View>
        ))}
        <Text style={p.listMore}>… and {stops.length - 5} more</Text>
      </View>

      <View style={p.rule} />
      <Text style={p.destLabel}>YOU LEAVE THE TRAIN AT</Text>
      <Text style={p.destName}>{stops[stops.length - 1]}</Text>

      <View style={p.footer}>
        <Text style={p.footerText}>SWIPE FOR THE NEXT STEP</Text>
        <View style={p.footerDots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[p.footerDot, i === 3 ? { backgroundColor: '#14110E' } : null]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const p = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2EEE4', paddingHorizontal: 30, paddingTop: 54 },
  headRule: { height: 5, backgroundColor: '#14110E', marginBottom: 16 },
  kicker: { color: '#14110E', fontSize: 11, fontWeight: '800', letterSpacing: 1.7, opacity: 0.65 },
  headline: { color: '#14110E', fontSize: 42, fontWeight: '800', letterSpacing: -1.6, lineHeight: 45, marginTop: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginTop: 30 },
  bullet: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  bulletGlyph: { fontSize: 45, fontWeight: '800', includeFontPadding: false },
  towardBlock: { marginLeft: 20, flexShrink: 1 },
  towardLabel: { color: '#14110E', opacity: 0.55, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  towardName: { color: '#14110E', fontSize: 27, fontWeight: '800', letterSpacing: -0.7, marginTop: 3 },
  rule: { height: 1, backgroundColor: '#14110E', opacity: 0.22, marginTop: 26 },
  body: { color: '#14110E', fontSize: 18, lineHeight: 26, marginTop: 22, opacity: 0.85 },
  bold: { fontWeight: '800', opacity: 1 },
  caption: { color: '#14110E', fontSize: 11.5, fontWeight: '700', letterSpacing: 0.9, lineHeight: 18, marginTop: 20, opacity: 0.7 },
  footer: { position: 'absolute', left: 30, right: 30, bottom: 34 },
  footerText: { color: '#14110E', opacity: 0.5, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.7 },
  footerDots: { flexDirection: 'row', marginTop: 10 },
  footerDot: { width: 22, height: 4, marginRight: 5, backgroundColor: 'rgba(20,17,14,0.22)' },
  list: { marginTop: 20 },
  listRow: { flexDirection: 'row', marginBottom: 15 },
  listNum: { width: 26, color: '#14110E', opacity: 0.45, fontSize: 15, fontWeight: '800' },
  listBody: { flexShrink: 1 },
  listName: { color: '#14110E', fontSize: 18, fontWeight: '600' },
  listNameHere: { fontWeight: '800', fontSize: 19 },
  listPassed: { color: '#14110E', opacity: 0.5, fontSize: 12.5, marginTop: 2, fontStyle: 'italic' },
  listMore: { color: '#14110E', opacity: 0.45, fontSize: 13, marginLeft: 26 },
  destLabel: { color: '#14110E', opacity: 0.55, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginTop: 22 },
  destName: { color: '#14110E', fontSize: 29, fontWeight: '800', letterSpacing: -0.9, marginTop: 3 },
});

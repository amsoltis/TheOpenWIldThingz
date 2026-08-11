import { createRoot } from 'react-dom/client';
import { StyleSheet, Text, View } from 'react-native';
import type { ReactElement, ReactNode } from 'react';

import type { TransitPacket } from '@streetlevel/shared';

import {
  BulletPlatform,
  BulletTrain,
  DiagramPlatform,
  DiagramTrain,
  PaperPlatform,
  PaperTrain,
  cardDataFrom,
} from './treatments.js';

import fixtures from '../screenshot/generated/fixtures.json';

const { packet } = fixtures as unknown as { packet: TransitPacket };
const cards = packet.outboundJourney.navigationCards;
const platform = cards.find((c) => c.phaseType === 'PLATFORM_WAIT')!;
const onTrain = cards.find((c) => c.phaseType === 'ON_TRAIN')!;
const data = cardDataFrom(platform, onTrain, packet.outboundJourney.destinationAddress);

function Phone({ children }: { children: ReactNode }): ReactElement {
  return (
    <View style={s.phone} dataSet={{ phone: 'true' }}>
      {children}
    </View>
  );
}

function Column({ title, note, children }: { title: string; note: string; children: ReactNode }): ReactElement {
  return (
    <View style={s.column}>
      <Text style={s.colTitle}>{title}</Text>
      <Text style={s.colNote}>{note}</Text>
      <View style={s.stack}>{children}</View>
    </View>
  );
}

function Study(): ReactElement {
  return (
    <View style={s.page}>
      <Text style={s.title}>Three directions — same card, same data</Text>
      <Text style={s.sub}>
        Waiting for the 3 at Times Square, then riding it. Nothing here is wired into the app.
      </Text>

      <View style={s.row}>
        <Column
          title="A · BULLET"
          note="The line colour is the room, not an accent. Transit Authority type, no button stack."
        >
          <Phone>
            <BulletPlatform data={data} />
          </Phone>
          <Phone>
            <BulletTrain data={data} />
          </Phone>
        </Column>

        <Column
          title="B · DIAGRAM"
          note="Vignelli's map stood upright and made the interface. The drawing is the navigation."
        >
          <Phone>
            <DiagramPlatform data={data} />
          </Phone>
          <Phone>
            <DiagramTrain data={data} />
          </Phone>
        </Column>

        <Column
          title="C · PAPER"
          note="Ink on warm paper. Higher contrast than black-on-black, and colour becomes precious."
        >
          <Phone>
            <PaperPlatform data={data} />
          </Phone>
          <Phone>
            <PaperTrain data={data} />
          </Phone>
        </Column>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { backgroundColor: '#17171A', padding: 34 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  sub: { color: '#9A9AA4', fontSize: 15, marginTop: 6, marginBottom: 30 },
  row: { flexDirection: 'row' },
  column: { marginRight: 34, width: 390 },
  colTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
  colNote: { color: '#82828C', fontSize: 13, lineHeight: 18, marginTop: 5, marginBottom: 16, height: 54 },
  stack: {},
  phone: {
    width: 390,
    height: 844,
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#2E2E33',
    marginBottom: 22,
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('no #root');
createRoot(container).render(<Study />);

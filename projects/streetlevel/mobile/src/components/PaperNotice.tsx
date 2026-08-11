import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PaperTheme } from '@streetlevel/shared';

export type NoticeTone = 'danger' | 'success';

interface PaperNoticeProps {
  caption: string;
  text: string;
  tone?: NoticeTone;
}

/**
 * The "do not walk down those stairs" plate.
 *
 * Colour is spent on the bar and the caption; the sentence itself is set in
 * full ink. This is deliberate and it is a safety decision rather than a taste
 * one — long-form red text is the least legible thing any palette can produce,
 * and this is the one paragraph that has to survive being read while walking,
 * in a tunnel, by someone who is already rushing. So the alarm is carried by
 * the container and the legibility is left to the words.
 *
 * The red itself is a printer's red, not a screen's. The dark-theme #FF453A
 * measures 2.2:1 on this paper — bright, cheerful and unreadable.
 */
export function PaperNotice({ caption, text, tone = 'danger' }: PaperNoticeProps): ReactElement {
  const colour = tone === 'danger' ? PaperTheme.colors.danger : PaperTheme.colors.success;
  const wash = tone === 'danger' ? PaperTheme.colors.dangerWash : PaperTheme.colors.successWash;

  return (
    <View style={[styles.box, { backgroundColor: wash }]} accessible accessibilityRole="alert">
      <View style={[styles.bar, { backgroundColor: colour }]} />
      <View style={styles.body}>
        <Text style={[styles.caption, { color: colour }]} allowFontScaling={false}>
          {caption}
        </Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
  },
  bar: {
    width: PaperTheme.rules.bar,
  },
  body: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  caption: {
    ...PaperTheme.type.micro,
    marginBottom: 6,
  },
  text: {
    ...PaperTheme.type.item,
    color: PaperTheme.colors.ink,
  },
});

import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { PaperTheme, SubwayTheme } from '@streetlevel/shared';

import { markdownToPlainText, parseMarkdownBlocks } from '../lib/markdown';

interface MarkdownTextProps {
  source: string;
  style?: TextStyle;
  color?: string;
  /**
   * Applied to every block after the first. The shaper writes the action in
   * the opening sentence and the reason in the ones after it — "Ride 14 stops
   * and get off at X." then "That is your stop for Y." — and setting both at
   * headline size makes the traveller read a paragraph to find the verb.
   */
  secondaryStyle?: TextStyle;
  secondaryColor?: string;
}

/**
 * Emphasis is rendered as weight, never as colour. Colour in this app is
 * reserved for line identity and for danger; a merely emphasised word tinted
 * red would read as a warning.
 */
export function MarkdownText({
  source,
  style,
  color,
  secondaryStyle,
  secondaryColor,
}: MarkdownTextProps): ReactElement {
  const blocks = parseMarkdownBlocks(source);
  const baseColor = color ?? PaperTheme.colors.ink;

  return (
    <View accessible accessibilityLabel={markdownToPlainText(source)}>
      {blocks.map((block, blockIndex) => {
        const demoted = blockIndex > 0 && secondaryStyle !== undefined;
        const blockStyle = demoted ? secondaryStyle : style;
        const blockColor = demoted ? (secondaryColor ?? baseColor) : baseColor;

        return (
          <View
            key={`${block.kind}-${blockIndex}`}
            style={block.kind === 'bullet' ? styles.bulletRow : styles.paragraphRow}
          >
            {block.kind === 'bullet' ? (
              <Text
                style={[blockStyle, { color: blockColor }, styles.bulletMark]}
                accessibilityElementsHidden
              >
                •
              </Text>
            ) : null}
            <Text style={[blockStyle, { color: blockColor }, styles.flexText]} allowFontScaling>
              {block.segments.map((segment, segmentIndex) => (
                <Text
                  key={`segment-${segmentIndex}`}
                  style={[
                    segment.bold ? styles.bold : null,
                    segment.italic ? styles.italic : null,
                  ]}
                >
                  {segment.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraphRow: {
    marginBottom: SubwayTheme.spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: SubwayTheme.spacing.sm,
  },
  bulletMark: {
    marginRight: SubwayTheme.spacing.sm,
  },
  flexText: {
    flexShrink: 1,
  },
  bold: {
    fontWeight: '900',
  },
  italic: {
    fontStyle: 'italic',
  },
});

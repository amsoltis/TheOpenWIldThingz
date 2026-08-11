import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

import { markdownToPlainText, parseMarkdownBlocks } from '../lib/markdown';

interface MarkdownTextProps {
  source: string;
  style?: TextStyle;
  color?: string;
}

/**
 * Emphasis is rendered as weight, never as colour. Colour in this app is
 * reserved for line identity and for danger; a merely emphasised word tinted
 * red would read as a warning.
 */
export function MarkdownText({ source, style, color }: MarkdownTextProps): ReactElement {
  const blocks = parseMarkdownBlocks(source);
  const baseColor = color ?? SubwayTheme.colors.textPrimary;

  return (
    <View accessible accessibilityLabel={markdownToPlainText(source)}>
      {blocks.map((block, blockIndex) => (
        <View
          key={`${block.kind}-${blockIndex}`}
          style={block.kind === 'bullet' ? styles.bulletRow : styles.paragraphRow}
        >
          {block.kind === 'bullet' ? (
            <Text style={[style, { color: baseColor }, styles.bulletMark]} accessibilityElementsHidden>
              •
            </Text>
          ) : null}
          <Text style={[style, { color: baseColor }, styles.flexText]} allowFontScaling>
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  paragraphRow: {
    marginBottom: SubwayTheme.spacing.sm,
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

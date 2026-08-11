import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SubwayTheme } from '@streetlevel/shared';

interface ExitSignPlateProps {
  stationName: string | null;
}

/**
 * The EXIT plate, drawn in the MTA's own black and white.
 *
 * Surfacing is the moment the traveller stops looking at the phone, so this is
 * the last thing the product can hand them: the exact sign that ends the
 * underground portion, with the station name under it so the plate at the top
 * of the stairs can be checked against something. Same vernacular as the
 * mezzanine sign on purpose — by this point in the trip it is a shape they have
 * already learned to trust.
 */
export function ExitSignPlate({ stationName }: ExitSignPlateProps): ReactElement {
  return (
    <View
      style={styles.plate}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        stationName ? `Exit sign. Leave the station at ${stationName}.` : 'Exit sign.'
      }
    >
      <View style={styles.face}>
        <View style={styles.arrow} accessibilityElementsHidden />
        <Text style={styles.word} allowFontScaling={false}>
          EXIT
        </Text>
      </View>
      {stationName ? (
        <View style={styles.stationRow}>
          <Text style={styles.caption} allowFontScaling={false}>
            LEAVE THE STATION AT
          </Text>
          <Text style={styles.stationName} numberOfLines={2}>
            {stationName}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: SubwayTheme.radii.plate,
    borderWidth: SubwayTheme.borders.emphasis,
    borderColor: SubwayTheme.colors.hairlineStrong,
    backgroundColor: SubwayTheme.colors.signPlate,
    overflow: 'hidden',
    boxShadow: SubwayTheme.elevation.card,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.sm,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: SubwayTheme.colors.signInk,
    marginRight: SubwayTheme.spacing.md,
  },
  word: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
    color: SubwayTheme.colors.signInk,
    includeFontPadding: false,
  },
  stationRow: {
    borderTopWidth: SubwayTheme.borders.hairline,
    borderTopColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: SubwayTheme.spacing.md,
    paddingVertical: SubwayTheme.spacing.sm,
  },
  caption: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.signInk,
    opacity: 0.6,
    marginBottom: SubwayTheme.spacing.xxs,
  },
  stationName: {
    ...SubwayTheme.typography.sectionTitle,
    color: SubwayTheme.colors.signInk,
  },
});

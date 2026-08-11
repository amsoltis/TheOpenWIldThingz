import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { RouteCard } from '@streetlevel/shared';
import { SubwayTheme } from '@streetlevel/shared';

import { PrimaryButton } from '../components/PrimaryButton';
import { RouteRibbon } from '../components/RouteRibbon';
import { RouteCardView } from '../components/RouteCardView';
import { playHapticPattern } from '../lib/haptics';
import { cardLines, journeySpine } from '../lib/journey';
import type { LegKey } from '../state/appMachine';

interface CardDeckScreenProps {
  cards: RouteCard[];
  index: number;
  activeLeg: LegKey;
  destinationLabel: string;
  durationLabel: string;
  onNext: () => void;
  onPrev: () => void;
  onSelectLeg: (leg: LegKey) => void;
  onNeedHelp: () => void;
}

/** How far a drag must travel before it counts as a deliberate card change. */
const SWIPE_COMMIT_RATIO = 0.28;
/** A fast flick counts even when it is short — the train is moving, so is the thumb. */
const SWIPE_VELOCITY_THRESHOLD = 0.4;

export function CardDeckScreen({
  cards,
  index,
  activeLeg,
  destinationLabel,
  durationLabel,
  onNext,
  onPrev,
  onSelectLeg,
  onNeedHelp,
}: CardDeckScreenProps): ReactElement {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  const card = cards[index];
  // The deck resolves which line every card belongs to once, so the ribbon, the
  // card chrome and the Next button all tint from the same answer — a mezzanine
  // card carrying no focus of its own still belongs to the train it leads to.
  const lines = useMemo(() => cardLines(cards), [cards]);
  const spine = useMemo(() => journeySpine(cards), [cards]);
  const cardLine = lines[index] ?? null;
  const legLine = lines.find((l) => l !== null) ?? null;
  const canNext = index < cards.length - 1;
  const canPrev = index > 0;

  // The PanResponder is created once so the gesture is not re-registered mid
  // drag; everything it needs is read from a ref that each render refreshes.
  const gesture = useRef({ width, canNext, canPrev, onNext, onPrev });
  gesture.current = { width, canNext, canPrev, onNext, onPrev };

  const commit = useMemo(
    () =>
      (direction: -1 | 1): void => {
        const { width: screenWidth, onNext: goNext, onPrev: goPrev } = gesture.current;
        isAnimating.current = true;
        Animated.timing(translateX, {
          toValue: direction * -screenWidth,
          duration: 160,
          useNativeDriver: true,
        }).start(() => {
          if (direction === 1) goNext();
          else goPrev();
          translateX.setValue(direction * screenWidth);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18,
          }).start(() => {
            isAnimating.current = false;
          });
        });
      },
    [translateX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, state) =>
          !isAnimating.current && Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.5,
        onPanResponderMove: (_event, state) => {
          const { canNext: forward, canPrev: back } = gesture.current;
          // Dragging against the end of the deck is damped rather than blocked,
          // so the deck feels finite instead of feeling broken.
          const resistance = (state.dx < 0 && !forward) || (state.dx > 0 && !back) ? 0.25 : 1;
          translateX.setValue(state.dx * resistance);
        },
        onPanResponderRelease: (_event, state) => {
          const { width: screenWidth, canNext: forward, canPrev: back } = gesture.current;
          const distance = Math.abs(state.dx);
          const committed =
            distance > screenWidth * SWIPE_COMMIT_RATIO ||
            Math.abs(state.vx) > SWIPE_VELOCITY_THRESHOLD;

          if (committed && state.dx < 0 && forward) {
            commit(1);
            return;
          }
          if (committed && state.dx > 0 && back) {
            commit(-1);
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [commit, translateX],
  );

  // Haptics are keyed to the card, not to the gesture: the traveller gets the
  // same jolt whether they swiped, tapped Next, or were moved on by the deck.
  const cardId = card?.cardId;
  const trigger = card?.hapticPatternTrigger;
  useEffect(() => {
    if (!cardId) return undefined;
    return playHapticPattern(trigger);
  }, [cardId, trigger]);

  const stepLabel = `STEP ${Math.min(index + 1, cards.length)} OF ${cards.length}`;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.legName} allowFontScaling={false}>
            {activeLeg === 'outbound' ? 'HEADING OUT' : 'HEADING HOME'}
          </Text>
          {durationLabel.length > 0 ? (
            <Text style={styles.duration} allowFontScaling={false}>
              {durationLabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.destination} numberOfLines={1}>
          {destinationLabel}
        </Text>
        {/* The one place the whole trip is visible at once. Everything else in
            this product is deliberately one step at a time, which leaves
            "how much of this is left" unanswerable without it. */}
        <RouteRibbon segments={spine} currentIndex={index} totalCards={cards.length} />
      </View>

      <Animated.View
        style={[styles.cardHolder, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {card ? (
          <RouteCardView
            card={card}
            stepLabel={stepLabel}
            line={cardLine}
            legLine={legLine}
            destinationLabel={destinationLabel}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              This leg has no steps yet. Use the button below and tell us what you can see.
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Swiping is never the only way forward. Gestures fail with gloves, wet
          hands, a cracked screen, or a screen reader — the buttons do not. */}
      <View style={styles.stepControls}>
        <PrimaryButton
          label="Back"
          onPress={onPrev}
          tone="secondary"
          disabled={!canPrev}
          accessibilityHint="Shows the previous step."
          style={styles.stepButton}
        />
        <View style={styles.stepSpacer} />
        {/* Forward is always green, never the line colour. On the 1/2/3 the
            accent is the same red as the danger button below it, and two red
            slabs stacked is a choice nobody should have to make at speed. The
            line's identity is carried by the ribbon and the card, which is
            where it belongs. */}
        <PrimaryButton
          label="Next"
          onPress={onNext}
          disabled={!canNext}
          accessibilityHint="Shows the next step."
          style={styles.stepButtonWide}
        />
      </View>

      {/* Anchored on every single card. Someone who is lost must never have to
          find their way back to a menu to say so. */}
      <PrimaryButton
        label="I Messed Up / Where Am I?"
        onPress={onNeedHelp}
        tone="alert"
        accessibilityHint="Describe your surroundings and we will work out where you are."
        style={styles.help}
      />

      <View style={styles.tabs}>
        <LegTab
          label="My Outbound Trip"
          selected={activeLeg === 'outbound'}
          onPress={() => onSelectLeg('outbound')}
        />
        <LegTab
          label="My Return Home"
          selected={activeLeg === 'return'}
          onPress={() => onSelectLeg('return')}
        />
      </View>
    </View>
  );
}

interface LegTabProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Oversized and always present. Both legs were compiled and cached together, so
 * this switch is a synchronous read — there is no spinner here by design, and
 * a traveller checking how they get home should never feel they left the trip.
 */
function LegTab({ label, selected, onPress }: LegTabProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tab, selected ? styles.tabSelected : null, pressed ? styles.tabPressed : null]}
    >
      <Text style={[styles.tabLabel, selected ? styles.tabLabelSelected : null]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // A deeper ground than the card. The deck reads as one object lifted off
    // the phone rather than as a dark screen with text arranged on it.
    backgroundColor: SubwayTheme.colors.backgroundDeep,
    paddingHorizontal: SubwayTheme.spacing.md,
  },
  header: {
    paddingTop: SubwayTheme.spacing.sm,
    paddingBottom: SubwayTheme.spacing.sm,
  },
  headerText: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legName: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textSecondary,
  },
  duration: {
    ...SubwayTheme.typography.microLabel,
    color: SubwayTheme.colors.textTertiary,
  },
  destination: {
    ...SubwayTheme.typography.sectionTitle,
    color: SubwayTheme.colors.textPrimary,
    marginTop: SubwayTheme.spacing.xs,
    marginBottom: SubwayTheme.spacing.sm,
  },
  cardHolder: {
    flex: 1,
  },
  emptyCard: {
    flex: 1,
    backgroundColor: SubwayTheme.colors.surfaceCard,
    borderRadius: SubwayTheme.radii.card,
    padding: SubwayTheme.spacing.lg,
    justifyContent: 'center',
  },
  emptyText: {
    ...SubwayTheme.typography.landmarkBody,
    color: SubwayTheme.colors.textSecondary,
  },
  stepControls: {
    flexDirection: 'row',
    marginTop: SubwayTheme.spacing.sm,
  },
  stepButton: {
    flex: 1,
  },
  stepButtonWide: {
    flex: 2,
  },
  stepSpacer: {
    width: SubwayTheme.spacing.sm,
  },
  help: {
    marginTop: SubwayTheme.spacing.sm,
  },
  // A segmented control rather than two loose buttons: the two legs are one
  // choice with two positions, and drawing them inside a single track says so.
  tabs: {
    flexDirection: 'row',
    marginTop: SubwayTheme.spacing.sm,
    padding: SubwayTheme.spacing.xs,
    borderRadius: SubwayTheme.radii.button + SubwayTheme.spacing.xs,
    backgroundColor: SubwayTheme.colors.surfaceSunken,
    borderWidth: SubwayTheme.borders.hairline,
    borderColor: SubwayTheme.colors.hairline,
  },
  tab: {
    flex: 1,
    minHeight: SubwayTheme.minTouchTarget,
    borderRadius: SubwayTheme.radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SubwayTheme.spacing.sm,
  },
  tabSelected: {
    backgroundColor: SubwayTheme.colors.textPrimary,
    boxShadow: SubwayTheme.elevation.raised,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    color: SubwayTheme.colors.textSecondary,
  },
  tabLabelSelected: {
    color: SubwayTheme.colors.backgroundDeep,
  },
});

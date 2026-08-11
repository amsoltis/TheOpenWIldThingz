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
import { PaperTheme, SubwayTheme } from '@streetlevel/shared';

import { PaperSection } from '../components/PaperSection';
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

/**
 * The deck.
 *
 * There used to be five slabs under every card: Back, Next, I Messed Up, and a
 * pair of leg tabs. That stack was the product's worst habit made visible —
 * each capability had been given a button rather than a place — and it cost a
 * third of the screen on a device whose whole job is to hold one instruction up
 * at arm's length.
 *
 * It is gone. Moving through the deck is a swipe, and how far through you are
 * is the segmented rail printed at the foot of the colour. What remains below
 * is a single quiet strip: a back and a next that keep the deck operable with
 * gloves, a cracked screen, or a screen reader, and the lost-and-found, which
 * is the one thing that must never be more than one tap away from a frightened
 * person. Choosing between the two legs is reference, not navigation, so it is
 * printed at the foot of the paper with the rest of the reference material.
 */
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
  // The deck resolves which line every card belongs to once, so the statement
  // zone and the ribbon tint from the same answer — a mezzanine card carrying
  // no focus of its own still belongs to the train it leads to.
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

  return (
    <View style={styles.root}>
      <Animated.View
        style={[styles.cardHolder, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {card ? (
          <RouteCardView
            card={card}
            stepIndex={index}
            stepTotal={cards.length}
            line={cardLine}
            legLine={legLine}
            destinationLabel={destinationLabel}
            trailing={
              <TripBand
                activeLeg={activeLeg}
                destinationLabel={destinationLabel}
                durationLabel={durationLabel}
                spine={spine}
                index={index}
                total={cards.length}
                onSelectLeg={onSelectLeg}
              />
            }
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
          hands, a cracked screen, or a screen reader — this strip does not. */}
      <View style={styles.strip}>
        <StepControl
          label="BACK"
          glyph="‹"
          onPress={onPrev}
          disabled={!canPrev}
          hint="Shows the previous step."
        />

        {/* Anchored on every single card. Someone who is lost must never have to
            find their way back to a menu to say so — but a full-width red slab
            on every screen said "press me", which is the wrong thing to say to
            somebody who is not lost yet. */}
        <Pressable
          onPress={onNeedHelp}
          accessibilityRole="button"
          accessibilityLabel="I Messed Up / Where Am I?"
          accessibilityHint="Describe your surroundings and we will work out where you are."
          hitSlop={SubwayTheme.spacing.sm}
          style={({ pressed }) => [styles.lost, pressed ? styles.pressed : null]}
        >
          <Text style={styles.lostLabel} allowFontScaling={false}>
            I'M LOST
          </Text>
        </Pressable>

        <StepControl
          label="NEXT"
          glyph="›"
          onPress={onNext}
          disabled={!canNext}
          hint="Shows the next step."
          trailing
        />
      </View>
    </View>
  );
}

interface StepControlProps {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled: boolean;
  hint: string;
  trailing?: boolean;
}

/**
 * Set as a word and a chevron rather than as a filled rectangle. It is still a
 * 56pt target — it simply stops claiming to be the thing the screen is for.
 */
function StepControl({ label, glyph, onPress, disabled, hint, trailing }: StepControlProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === 'BACK' ? 'Back' : 'Next'}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      hitSlop={SubwayTheme.spacing.sm}
      style={({ pressed }) => [
        styles.step,
        pressed ? styles.pressed : null,
        disabled ? styles.stepDisabled : null,
      ]}
    >
      {trailing ? null : (
        <Text style={styles.stepGlyph} allowFontScaling={false}>
          {glyph}
        </Text>
      )}
      <Text style={styles.stepLabel} allowFontScaling={false}>
        {label}
      </Text>
      {trailing ? (
        <Text style={styles.stepGlyph} allowFontScaling={false}>
          {glyph}
        </Text>
      ) : null}
    </Pressable>
  );
}

interface TripBandProps {
  activeLeg: LegKey;
  destinationLabel: string;
  durationLabel: string;
  spine: ReturnType<typeof journeySpine>;
  index: number;
  total: number;
  onSelectLeg: (leg: LegKey) => void;
}

/**
 * The reference block at the foot of the paper: which trip this is, how long it
 * takes, its whole shape, and the switch to the other leg.
 *
 * Printed at the end rather than pinned to the chrome because none of it is an
 * instruction. Both legs were compiled and cached together, so the switch is a
 * synchronous read with no spinner — a traveller checking how they get home
 * should never feel they left the trip they are on.
 */
function TripBand({
  activeLeg,
  destinationLabel,
  durationLabel,
  spine,
  index,
  total,
  onSelectLeg,
}: TripBandProps): ReactElement {
  return (
    <View style={styles.band}>
      <PaperSection
        label={activeLeg === 'outbound' ? 'HEADING OUT' : 'HEADING HOME'}
        trailing={durationLabel.length > 0 ? durationLabel.toUpperCase() : undefined}
      >
        <Text style={styles.bandDestination} numberOfLines={2}>
          {destinationLabel}
        </Text>
        <View style={styles.bandRibbon}>
          <RouteRibbon segments={spine} currentIndex={index} totalCards={total} />
        </View>

        <View style={styles.legTabs}>
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
      </PaperSection>
    </View>
  );
}

interface LegTabProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function LegTab({ label, selected, onPress }: LegTabProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.legTab, pressed ? styles.pressed : null]}
    >
      <Text
        style={[styles.legTabLabel, selected ? styles.legTabLabelSelected : null]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={[styles.legTabRule, selected ? styles.legTabRuleSelected : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaperTheme.colors.paper,
  },
  cardHolder: {
    flex: 1,
  },
  emptyCard: {
    flex: 1,
    padding: PaperTheme.margin,
    justifyContent: 'center',
  },
  emptyText: {
    ...PaperTheme.type.body,
    color: PaperTheme.colors.inkMuted,
  },
  /**
   * One strip, one rule above it, nothing filled. The card ends where the paper
   * ends and this reads as the foot of the page rather than as a toolbar.
   */
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PaperTheme.colors.rule,
    paddingHorizontal: PaperTheme.margin - 8,
  },
  step: {
    minHeight: SubwayTheme.minTouchTarget,
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stepDisabled: {
    opacity: 0.25,
  },
  stepGlyph: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
    color: PaperTheme.colors.ink,
    marginHorizontal: 5,
    includeFontPadding: false,
  },
  stepLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.ink,
  },
  lost: {
    minHeight: SubwayTheme.minTouchTarget,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: PaperTheme.colors.danger,
    marginVertical: 8,
  },
  lostLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.danger,
  },
  pressed: {
    opacity: 0.6,
  },
  band: {
    marginTop: 30,
  },
  bandDestination: {
    ...PaperTheme.type.nameSmall,
    color: PaperTheme.colors.ink,
  },
  bandRibbon: {
    marginTop: 14,
  },
  legTabs: {
    flexDirection: 'row',
    marginTop: 22,
  },
  legTab: {
    flex: 1,
    minHeight: SubwayTheme.minTouchTarget,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    marginRight: 16,
  },
  legTabLabel: {
    ...PaperTheme.type.micro,
    color: PaperTheme.colors.inkMuted,
    marginBottom: 8,
  },
  legTabLabelSelected: {
    color: PaperTheme.colors.ink,
  },
  legTabRule: {
    height: 2,
    backgroundColor: PaperTheme.colors.rule,
  },
  legTabRuleSelected: {
    height: 3,
    backgroundColor: PaperTheme.colors.ink,
  },
});

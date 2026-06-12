import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Easing as RNEasing,
  LayoutAnimation,
  Platform,
  Animated as RNAnimated,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
  ShadowDecorator,
} from "react-native-draggable-flatlist";
import {
  State as GestureState,
  PanGestureHandler,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "../store/player.store";
import { PlayerTrack } from "../types/player";
import { QueueActionSheet } from "./QueueActionSheet";
import AddToPlaylistSheet from "@/src/features/playlist/components/AddToPlaylistSheet";
import { getTrackArtwork } from "@/src/features/player/utils/track-identity";

type AnimatedPanGestureEvent = {
  nativeEvent: {
    translationY: number;
    velocityY: number;
    state: number;
  };
};

// ─── LayoutAnimation setup (handled by platform defaults in new arch) ─────────────────

const { width: SW, height: SH } = Dimensions.get("window");
const isTablet = SW >= 768;
const SHEET_H = SH * 0.88; // Slightly taller for better queue visibility
const ROW_H = 76; 

// Spring configs - Refined for "buttery smooth" feel
const SPR_SHEET = { damping: 24, stiffness: 220, mass: 0.8 };
const SPR_ROW = { damping: 20, stiffness: 200 };

// ─── Colour helpers ───────────────────────────────────────────────────────────
const h2r = (hex: string, a: number) => {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  } catch (e) {
    return `rgba(120,120,120,${a})`;
  }
};

const SPEC_TOP = "rgba(255,255,255,0.20)";
const BORDER_TOP = "rgba(255,255,255,0.18)";
const SURFACE = "rgba(18,18,26,0.72)";

// ─── Glass card ───────────────────────────────────────────────────────────────
const Glass = ({
  children,
  style,
  r = 20,
  blur = 55,
  tintColor,
}: {
  children?: React.ReactNode;
  style?: any;
  r?: number;
  blur?: number;
  tintColor?: string;
}) => (
  <View style={[{ borderRadius: r, overflow: "hidden" }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: r, backgroundColor: SURFACE },
      ]}
    />
    {tintColor && (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: r, backgroundColor: tintColor },
        ]}
      />
    )}
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: r * 0.4,
        right: r * 0.4,
        height: 1,
        backgroundColor: SPEC_TOP,
        zIndex: 9,
      }}
    />
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: r,
        borderWidth: 0.7,
        borderTopColor: BORDER_TOP,
        borderLeftColor: "rgba(255,255,255,0.07)",
        borderRightColor: "rgba(255,255,255,0.07)",
        borderBottomColor: "rgba(255,255,255,0.04)",
        backgroundColor: "transparent",
      }}
    />
    {children}
  </View>
);
Glass.displayName = "Glass";

// ─── Animated EQ bars ─────────────────────────────────────────────────────────
const EqBars = React.memo(({ color }: { color: string }) => {
  const bars = [
    useRef(new RNAnimated.Value(0.4)).current,
    useRef(new RNAnimated.Value(0.7)).current,
    useRef(new RNAnimated.Value(0.5)).current,
  ];

  useEffect(() => {
    const anims = bars.map((bar, i) =>
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(bar, {
            toValue: 1,
            duration: 340 + i * 90,
            easing: RNEasing.inOut(RNEasing.sin),
            useNativeDriver: true,
          }),
          RNAnimated.timing(bar, {
            toValue: 0.28,
            duration: 340 + i * 90,
            easing: RNEasing.inOut(RNEasing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [bars]);

  return (
    <View style={s.eqWrap}>
      {bars.map((bar, i) => (
        <RNAnimated.View
          key={i}
          style={[
            s.eqBar,
            {
              backgroundColor: color,
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
});
EqBars.displayName = "EqBars";

interface QueueSheetProps {
  isVisible: boolean;
  onClose: () => void;
  accentColor: string;
}

export const QueueSheet = ({
  isVisible,
  onClose,
  accentColor,
}: QueueSheetProps) => {
  const insets = useSafeAreaInsets();
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const jumpToQueueIndex = usePlayerStore((s) => s.jumpToQueueIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isReordering = usePlayerStore((s) => s.isReordering);

  // Local copy for smooth dragging
  const [localQueue, setLocalQueue] = useState<PlayerTrack[]>([]);

  useEffect(() => {
    if (!isReordering) {
      setLocalQueue(queue);
    }
  }, [queue, isReordering]);

  // Action sheet state
  const [actionTrack, setActionTrack] = useState<PlayerTrack | null>(null);
  const [actionIndex, setActionIndex] = useState<number>(-1);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<PlayerTrack | null>(null);

  // Sheet gesture-dismiss
  const handleY = useSharedValue(0);
  const sheetAnim = useSharedValue(SHEET_H);

  useEffect(() => {
    sheetAnim.value = withSpring(isVisible ? 0 : SHEET_H, SPR_SHEET);
  }, [isVisible, sheetAnim]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetAnim.value + Math.max(0, handleY.value) }],
    opacity: withTiming(isVisible ? 1 : 0.9, { duration: 200 }),
  }));

  const backdropOpacity = useSharedValue(0);
  useEffect(() => {
    backdropOpacity.value = withTiming(isVisible ? 1 : 0, { 
      duration: isVisible ? 240 : 300,
      easing: Easing.out(Easing.cubic)
    });
  }, [isVisible, backdropOpacity]);
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleGesture = useCallback(
    (event: AnimatedPanGestureEvent) => {
      const { translationY, velocityY, state } = event.nativeEvent;
      if (state === GestureState.ACTIVE) {
        handleY.value = Math.max(0, translationY);
      } else if (
        state === GestureState.END ||
        state === GestureState.CANCELLED ||
        state === GestureState.FAILED
      ) {
        if (translationY > 100 || velocityY > 800) {
          handleY.value = withSpring(SHEET_H, SPR_SHEET);
          onClose();
        } else {
          handleY.value = withSpring(0, SPR_SHEET);
        }
      }
    },
    [handleY, onClose],
  );

  const onDragEnd = useCallback(
    ({ data, from, to }: { data: PlayerTrack[]; from: number; to: number }) => {
      setLocalQueue(data);
      if (from !== to) {
        reorderQueue(from, to);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [reorderQueue],
  );

  const handleTrackPress = useCallback(
    async (trackId: string) => {
      const state = usePlayerStore.getState();
      const index = state.queue.findIndex(t => t.id === trackId);
      if (index === -1 || index === state.currentIndex) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await state.jumpToQueueIndex(index);
      onClose();
    },
    [onClose],
  );

  const handleMenuPress = useCallback(
    (track: PlayerTrack) => {
      const state = usePlayerStore.getState();
      const index = state.queue.findIndex(t => t.id === track.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActionTrack(track);
      setActionIndex(index);
    },
    [],
  );

  const handleRemove = useCallback(
    (index: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeFromQueue(index);
    },
    [removeFromQueue],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PlayerTrack>) => {
      const isPlaying = item.id === currentTrack?.id;
      
      return (
        <ScaleDecorator>
          <ShadowDecorator>
            <TouchableOpacity
              onLongPress={drag}
              disabled={isActive}
              activeOpacity={1}
            >
              <QueueRow
                item={item}
                accentColor={accentColor}
                isPlaying={isPlaying}
                isActive={isActive}
                onPress={() => handleTrackPress(item.id)}
                onMenuPress={() => handleMenuPress(item)}
                onDrag={drag}
              />
            </TouchableOpacity>
          </ShadowDecorator>
        </ScaleDecorator>
      );
    },
    [currentTrack, accentColor, handleTrackPress, handleMenuPress],
  );


  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close queue"
          accessibilityRole="button"
        >
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[s.sheet, sheetStyle, { paddingBottom: insets.bottom + 16 }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={["rgba(12,10,20,0.97)", "rgba(8,8,14,0.99)"]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[h2r(accentColor, 0.12), "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.4 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.sheetTopBorder} />
        </View>

        <PanGestureHandler onGestureEvent={handleGesture}>
          <Animated.View style={s.handleArea}>
            <View style={s.handleBar} />
          </Animated.View>
        </PanGestureHandler>

        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Queue</Text>
            <Text style={s.headerSubtitle}>
              {queue.length} tracks total
            </Text>
          </View>
          <View style={s.headerActions}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleShuffle();
              }}
              style={[
                s.headerIconBtn,
                isShuffle && { backgroundColor: h2r(accentColor, 0.18) },
              ]}
              accessibilityLabel={isShuffle ? "Disable shuffle" : "Enable shuffle"}
              accessibilityRole="button"
            >
              {isShuffle && (
                <View style={[s.headerIconBtnGlow, { backgroundColor: h2r(accentColor, 0.25) }]} />
              )}
              <Ionicons
                name="shuffle"
                size={19}
                color={isShuffle ? accentColor : "rgba(255,255,255,0.55)"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              accessibilityLabel="Close queue"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.listWrap}>
          <DraggableFlatList
            data={localQueue}
            onDragEnd={onDragEnd}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            containerStyle={s.listContainer}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            activationDistance={10}
            onPlaceholderIndexChange={() => Haptics.selectionAsync()}
            ListEmptyComponent={<EmptyState accentColor={accentColor} />}
            ListHeaderComponent={() => (
               <View style={s.listHeader}>
                  <Text style={s.sectionLabel}>All Tracks</Text>
                  <Text style={s.dragHint}>Long press & drag to reorder</Text>
               </View>
            )}
          />
        </View>
      </Animated.View>

      <QueueActionSheet
        visible={actionTrack !== null}
        track={actionTrack}
        onClose={() => {
          setActionTrack(null);
          setActionIndex(-1);
        }}
        onPlayNext={playNext}
        onAddToQueue={addToQueue}
        onRemove={handleRemove}
        onAddToPlaylist={(track) => setAddToPlaylistTrack(track)}
        trackIndex={actionIndex}
      />
      <AddToPlaylistSheet
        visible={addToPlaylistTrack !== null}
        track={addToPlaylistTrack}
        onClose={() => setAddToPlaylistTrack(null)}
      />
    </View>
  );
};

interface QueueRowProps {
  item: PlayerTrack;
  accentColor: string;
  isPlaying: boolean;
  isActive: boolean;
  onPress: () => void;
  onMenuPress: () => void;
  onDrag: () => void;
}

const QueueRow = React.memo(
  ({
    item,
    accentColor,
    isPlaying,
    isActive,
    onPress,
    onMenuPress,
    onDrag,
  }: QueueRowProps) => {
    const duration = item.duration ? Math.floor(item.duration / 1000) : 0;
    const mm = Math.floor(duration / 60);
    const ss = duration % 60;
    const durationText = `${mm}:${ss.toString().padStart(2, "0")}`;

    const rowOpacity = useSharedValue(1);
    useEffect(() => {
      rowOpacity.value = withTiming(isActive ? 0.6 : 1, { duration: 150 });
    }, [isActive, rowOpacity]);

    const rowStyle = useAnimatedStyle(() => ({
      opacity: rowOpacity.value,
      transform: [{ scale: withSpring(isActive ? 1.05 : 1, { damping: 15 }) }],
    }));

    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={s.rowOuter}
      >
        <Animated.View style={rowStyle}>
          <Glass
            r={18}
            blur={46}
            style={[
              s.rowGlass,
              isPlaying && { borderColor: h2r(accentColor, 0.4), borderWidth: 1 },
            ]}
            tintColor={isPlaying ? h2r(accentColor, 0.1) : isActive ? h2r(accentColor, 0.15) : undefined}
          >
            <View style={s.rowInner}>
              {/* Drag Handle */}
              <TouchableOpacity
                onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                onLongPress={onDrag}
                style={s.dragHandle}
              >
                <Ionicons
                  name="reorder-three"
                  size={22}
                  color={isPlaying ? accentColor : "rgba(255,255,255,0.22)"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.rowPressable}
                onPress={onPress}
                activeOpacity={0.7}
              >
                <View style={s.artWrap}>
                  <Image
                    source={{ uri: getTrackArtwork(item) }}
                    style={s.art}
                    contentFit="cover"
                    transition={200}
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFillObject,
                      {
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                      },
                    ]}
                  />
                  {isPlaying && (
                    <View style={s.rowEqOverlay}>
                        <EqBars color={accentColor} />
                    </View>
                  )}
                </View>

                <View style={s.trackInfo}>
                  <Text 
                    style={[s.trackTitle, isPlaying && { color: accentColor }]} 
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={s.trackArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>

                <View style={s.rowRight}>
                  {!isPlaying && <Text style={s.duration}>{durationText}</Text>}
                  <TouchableOpacity
                    onPress={onMenuPress}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                    style={s.menuBtn}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={18}
                      color="rgba(255,255,255,0.3)"
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </Glass>
        </Animated.View>
      </Animated.View>
    );
  },
);
QueueRow.displayName = "QueueRow";

const EmptyState = ({ accentColor }: { accentColor: string }) => (
  <View style={s.emptyWrap}>
    <Glass r={26} blur={50} style={s.emptyGlass}>
      <LinearGradient
        colors={[h2r(accentColor, 0.08), "transparent"]}
        style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
        pointerEvents="none"
      />
      <View style={s.emptyIconWrap}>
        <LinearGradient
          colors={[h2r(accentColor, 0.2), h2r(accentColor, 0.08)]}
          style={s.emptyIconBg}
        >
          <Ionicons
            name="musical-notes-outline"
            size={32}
            color={accentColor}
          />
        </LinearGradient>
      </View>
      <Text style={s.emptyTitle}>Queue is empty</Text>
      <Text style={s.emptySub}>Add songs to build your queue.</Text>
    </Glass>
  </View>
);

const s = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_H,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
  },
  sheetTopBorder: {
    position: "absolute",
    top: 0,
    left: 60,
    right: 60,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 1,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  handleBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: isTablet ? 26 : 22,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.32)",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerIconBtnGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  listWrap: { flex: 1 },
  listContainer: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 10,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  dragHint: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    fontWeight: "600",
    fontStyle: "italic",
  },
  rowOuter: {
    marginVertical: 0,
  },
  rowGlass: {
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
    minHeight: ROW_H,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW_H,
  },
  dragHandle: {
    paddingHorizontal: 12,
    height: ROW_H,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 44,
  },
  rowPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    paddingVertical: 12,
    gap: 14,
  },
  artWrap: { position: "relative", flexShrink: 0 },
  art: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  rowEqOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  trackInfo: { flex: 1 },
  trackTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: -0.2,
  },
  trackArtist: {
    fontSize: 13,
    color: "rgba(255,255,255,0.42)",
    marginTop: 3,
    fontWeight: "500",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  duration: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontWeight: "600",
  },
  menuBtn: {
    padding: 8,
    minWidth: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  eqWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  eqBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  emptyWrap: {
    paddingHorizontal: 22,
    paddingTop: 48,
  },
  emptyGlass: {
    padding: 40,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  emptyIconWrap: { marginBottom: 24 },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  emptySub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.38)",
    textAlign: "center",
    lineHeight: 22,
  },
});


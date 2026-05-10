import { usePlayerStore } from "@/src/features/player/store/player.store";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated as RNAnimated
} from "react-native";
import Animated, {
    useAnimatedScrollHandler,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// ── Components ───────────────────────────────────────────────────────────────

const LyricRow = memo(({ 
  text, 
  isActive, 
  isSynced, 
  onPress, 
  accent 
}: { 
  text: string, 
  isActive: boolean, 
  isSynced: boolean, 
  onPress: () => void,
  accent: string 
}) => {
  return (
    <TouchableOpacity
      activeOpacity={isSynced ? 0.7 : 1}
      onPress={onPress}
      style={styles.lyricItemContainer}
      disabled={!isSynced}
    >
      <Text style={[
        styles.lyricText,
        isActive ? [styles.lyricTextActive, { textShadowColor: accent }] : styles.lyricTextInactive
      ]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
});

export default function LyricsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Store Data
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const lyricsData = usePlayerStore(s => s.lyrics);
  const isLoading = usePlayerStore(s => s.isLyricsLoading);
  const seek = usePlayerStore(s => s.seek);
  const elapsedSec = usePlayerStore(s => s.position / 1000);
  const durationSec = usePlayerStore(s => s.duration / 1000);

  const flashListRef = useRef<any>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const accent = currentTrack?.dominantColors?.[0] || "#BF5AF2";

  // Lyrics derived state
  const lyrics = useMemo(() => lyricsData?.lyrics || [], [lyricsData]);
  const isSynced = useMemo(() => lyricsData?.synced || false, [lyricsData]);

  // Find active lyric index
  const activeIndex = useMemo(() => {
    if (!isSynced || !lyrics.length) return -1;
    // Find the latest line that has time <= current progress
    const currentMs = elapsedSec * 1000;
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time <= currentMs) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [lyrics, elapsedSec, isSynced]);

  // Auto-scroll to active index
  useEffect(() => {
    if (isSynced && activeIndex !== -1 && !isUserScrolling) {
      flashListRef.current?.scrollToIndex({
        index: activeIndex,
        animated: true,
        viewPosition: 0.3, // Keep active line slightly above center
      });
    }
  }, [activeIndex, isSynced, isUserScrolling]);

  const handleScrollBegin = () => {
    setIsUserScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
  };

  const handleScrollEnd = () => {
    // Resume auto-follow after 3 seconds of inactivity
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  };

  const handleLyricPress = useCallback((item: any) => {
    if (isSynced && item.time >= 0) {
      // Store's seek action expects milliseconds
      usePlayerStore.getState().seek(item.time);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsUserScrolling(false);
    }
  }, [isSynced]);

  const onShare = async () => {
    if (!currentTrack) return;
    try {
      await Share.share({
        message: `Check out the lyrics for "${currentTrack.title}" by ${currentTrack.artist} on AuraMusic!`,
      });
    } catch (error) {
      console.error("Sharing failed:", error);
    }
  };

  if (!currentTrack) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent />
      
      {/* Immersive Background */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0c0c10" }]} />
        <LinearGradient
          colors={[`${accent}25`, "transparent", "#0c0c10"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.glowSpot, { top: "10%", left: "-20%", backgroundColor: accent }]} />
        <View style={[styles.glowSpot, { bottom: "5%", right: "-20%", backgroundColor: accent, opacity: 0.1 }]} />
      </View>

      <View style={[styles.main, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="chevron-down-outline" size={32} color="white" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={styles.headerArtist} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>

          <TouchableOpacity onPress={onShare} style={styles.headerIcon}>
            <Ionicons name="share-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={styles.statusText}>Searching for lyrics...</Text>
            </View>
          ) : lyrics.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="musical-notes-outline" size={64} color="rgba(255,255,255,0.1)" />
              <Text style={styles.statusText}>No lyrics available for this track</Text>
            </View>
          ) : (
            <FlashList
              ref={flashListRef}
              data={lyrics}
              // @ts-ignore - estimatedItemSize is required but falsely reported missing by current TS config
              estimatedItemSize={80}
              keyExtractor={(item: any, index: number) => index.toString()}
              renderItem={({ item, index }: any) => (
                <LyricRow 
                  text={item.text} 
                  isActive={index === activeIndex} 
                  isSynced={isSynced}
                  accent={accent}
                  onPress={() => handleLyricPress(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={handleScrollBegin}
              onScrollEndDrag={handleScrollEnd}
              onMomentumScrollEnd={handleScrollEnd}
            />
          )}
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0c0c10",
  },
  main: {
    flex: 1,
  },
  glowSpot: {
    position: "absolute",
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    opacity: 0.15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 70,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerArtist: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  statusText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    marginTop: 20,
    textAlign: "center",
  },
  listContent: {
    paddingTop: height * 0.15,
    paddingBottom: height * 0.4,
    paddingHorizontal: 32,
  },
  lyricItemContainer: {
    minHeight: 80,
    justifyContent: "center",
    paddingVertical: 10,
  },
  lyricText: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 38,
    fontFamily: Platform.OS === "ios" ? "System" : "Manrope",
  },
  lyricTextActive: {
    color: "white",
    textShadowRadius: 25,
  },
  lyricTextInactive: {
    color: "rgba(255,255,255,0.15)",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  miniControlBar: {
    flexDirection: "row",
    alignItems: "center",
    width: width - 40,
    padding: 10,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  miniInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  miniActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  }
});

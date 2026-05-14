import { useMusic } from "@/src/context/MusicContext";
import { PlayerTrack } from "@/src/features/player/types/player";
import { useSearch } from "@/src/hooks/use-search";
import { useMusicNavigation } from "@/src/navigation/music-navigation";
import { MusicTrack } from "@/src/types/music";
import { useRecentSearchStore } from "@/src/features/search/store/recent-search.store";
import { RecentSearchItem } from "@/src/features/search/types/recent-search";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Animated,
    Dimensions,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryTabs } from "@/src/components/CategoryTabs";

const { width: SW, height: SH } = Dimensions.get("window");
const isTablet = SW >= 768;
const PAD = isTablet ? 32 : 22;

const TRACK_URLS: Record<string, string> = {
  nebula: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  neon: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  solar: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  nightcall: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
};

// ── Skeleton Loader ────────────────────────────────────────────────────────
const SkeletonRow = ({ delay = 0 }: { delay?: number }) => {
  const op = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Mat delay={delay}>
      <Glass style={s.songCard} r={18} blur={55}>
        <View style={s.songInner}>
          <Animated.View
            style={[
              s.songArt,
              { backgroundColor: "rgba(255,255,255,0.1)", opacity: op },
            ]}
          />
          <View style={s.songMeta}>
            <Animated.View
              style={{
                height: 16,
                width: "60%",
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 4,
                marginBottom: 8,
                opacity: op,
              }}
            />
            <Animated.View
              style={{
                height: 12,
                width: "40%",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 4,
                opacity: op,
              }}
            />
          </View>
        </View>
      </Glass>
    </Mat>
  );
};

// ── Tokens ─────────────────────────────────────────────────────────────────
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDp: "#7B2FBE",
  accent: "#46f5e0",
  bg: "#08080D",
  surface: "rgba(18,18,22,0.75)",
  border: "rgba(255,255,255,0.09)",
  text: "#FFFFFF",
  muted: "rgba(200,195,215,0.65)",
  dim: "rgba(170,160,190,0.40)",
};
const SP = { tension: 60, friction: 9 };
const PP = { tension: 200, friction: 8 };

const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── 4-Layer Liquid Glass card ──────────────────────────────────────────────
const Glass = ({ children, style, r = 20, blur = 65 }: any) => (
  <View
    style={[
      {
        borderRadius: r,
        overflow: "hidden",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
      },
      style,
    ]}
  >
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    {/* Decorative layers - pointerEvents="none" to ensure touches pass through to children */}
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: r * 0.5,
        right: r * 0.5,
        height: 1.5,
        backgroundColor: "rgba(255,255,255,0.20)",
        zIndex: 8,
      }}
    />
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 7,
        top: 9,
        bottom: 9,
        width: 2.5,
        backgroundColor: "rgba(255,255,255,0.12)",
        transform: [{ skewX: "-8deg" }],
        zIndex: 8,
      }}
    />
    <View
      pointerEvents="none"
      style={{
        ...StyleSheet.absoluteFillObject,
        borderRadius: r,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.13)",
        backgroundColor: "rgba(255,255,255,0.025)",
      }}
    />
    {children}
  </View>
);

// ── Materialise entrance ────────────────────────────────────────────────────
const Mat = ({ children, delay = 0, style }: any) => {
  const sc = useRef(new Animated.Value(0.93)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, ...SP, useNativeDriver: true }),
        Animated.timing(op, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.spring(ty, { toValue: 0, ...SP, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return (
    <Animated.View
      style={[
        { opacity: op, transform: [{ scale: sc }, { translateY: ty }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ── Press scale hook ────────────────────────────────────────────────────────
const useP = () => {
  const sc = useRef(new Animated.Value(1)).current;
  const onIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(sc, {
      toValue: 0.94,
      ...PP,
      useNativeDriver: true,
    }).start();
  };
  const onOut = () =>
    Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }).start();
  return { sc, onIn, onOut };
};

// ── Liked state hook ────────────────────────────────────────────────────────
const useHeart = () => {
  const [liked, setLiked] = useState(false);
  const sc = useRef(new Animated.Value(1)).current;
  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(sc, { toValue: 1.4, ...PP, useNativeDriver: true }),
      Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }),
    ]).start();
    setLiked((v) => !v);
  };
  return { liked, toggle, sc };
};

// ── Song row ────────────────────────────────────────────────────────────────
const SongRow = ({ song, onPlay, delay = 0 }: any) => {
  const p = useP();
  const h = useHeart();
  return (
    <Mat delay={delay}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <Glass style={s.songCard} r={18} blur={55}>
          <TouchableOpacity
            style={s.songInner}
            onPressIn={p.onIn}
            onPressOut={p.onOut}
            onPress={() => onPlay(song)}
            activeOpacity={1}
            onLongPress={() =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            }
          >
            <Image
              source={{ uri: song.art }}
              style={s.songArt}
              contentFit="cover"
              transition={200}
            />
            <View style={s.songMeta}>
              <Text style={s.songTitle} numberOfLines={1}>
                {song.title}
              </Text>
              <Text style={s.songArtist} numberOfLines={1}>
                {song.artist}
              </Text>
            </View>
            <Text style={s.songTime}>{song.time}</Text>
            <Animated.View style={{ transform: [{ scale: h.sc }] }}>
              <TouchableOpacity
                onPress={h.toggle}
                style={s.iconSmall}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={h.liked ? "heart" : "heart-outline"}
                  size={18}
                  color={h.liked ? C.primary : "rgba(255,255,255,0.30)"}
                />
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity
              style={s.iconSmall}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={17}
                color="rgba(255,255,255,0.28)"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Glass>
      </Animated.View>
    </Mat>
  );
};

// ── Artist row ──────────────────────────────────────────────────────────────
const ArtistRow = ({ artist, delay = 0, onPress }: any) => {
  const p = useP();
  return (
    <Mat delay={delay}>
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
        <Glass style={s.artistCard} r={18} blur={50}>
          <TouchableOpacity
            style={s.artistInner}
            onPressIn={p.onIn}
            onPressOut={p.onOut}
            activeOpacity={1}
            onPress={onPress}
            onLongPress={() =>
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
            }
            accessibilityRole="button"
            accessibilityLabel={`Open ${artist.name}`}
          >
            <View style={s.artistAvatarWrap}>
              <Image
                source={{ uri: artist.art }}
                style={s.artistAvatar}
                contentFit="cover"
              />
              <View style={s.artistAvatarRing} />
            </View>
            <View style={s.artistMeta}>
              <Text style={s.artistName} numberOfLines={1}>
                {artist.name}
              </Text>
              <Text style={s.artistFollowers}>
                {artist.followers} Followers
              </Text>
            </View>
            <TouchableOpacity style={s.followBtn}>
              <LinearGradient
                colors={[h2r(C.primary, 0.2), h2r(C.primaryMid, 0.12)]}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: h2r(C.primary, 0.4),
                }}
              />
              <Text style={s.followText}>Follow</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Glass>
      </Animated.View>
    </Mat>
  );
};

// ── Album card ──────────────────────────────────────────────────────────────
const AlbumCard = ({ album, delay = 0, onPress }: any) => {
  const p = useP();
  const W = (SW - PAD * 2 - 16) / (isTablet ? 4 : 2);
  return (
    <Mat delay={delay}>
      <Animated.View style={{ transform: [{ scale: p.sc }], width: W }}>
        <TouchableOpacity
          onPressIn={p.onIn}
          onPressOut={p.onOut}
          activeOpacity={1}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${album.title}`}
        >
          <View
            style={[s.albumArtWrap, { width: W, height: W, borderRadius: 20 }]}
          >
            <Image
              source={{ uri: album.art }}
              style={{ width: W, height: W, borderRadius: 20 }}
              contentFit="cover"
              transition={200}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
              }}
            />
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 12,
                right: 12,
                height: 1.5,
                backgroundColor: "rgba(255,255,255,0.20)",
              }}
            />
          </View>
          <Text style={s.albumTitle} numberOfLines={1}>
            {album.title}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Mat>
  );
};

// ── Section heading ─────────────────────────────────────────────────────────
const SectionHead = ({ title, accent = false }: any) => (
  <View style={s.secHeadRow}>
    <View
      style={[
        s.secAccentBar,
        {
          backgroundColor: accent ? C.accent : C.primary,
          ...Platform.select({
            ios: {
              shadowColor: accent ? C.accent : C.primary,
              shadowRadius: 5,
              shadowOpacity: 0.8,
              shadowOffset: { width: 0, height: 0 },
            },
          }),
        },
      ]}
    />
    <Text style={s.secTitle}>{title}</Text>
  </View>
);

// ── Recent search item ──────────────────────────────────────────────────────
const RecentItem = ({ item, onPress, onDelete }: any) => {
  const p = useP();
  const W = (SW - PAD * 2 - 12) / 2;
  return (
    <Animated.View style={{ transform: [{ scale: p.sc }], width: W }}>
      <Glass style={s.recentCard} r={16} blur={45}>
        <TouchableOpacity
          style={s.recentInner}
          onPressIn={p.onIn}
          onPressOut={p.onOut}
          onPress={() => onPress(item)}
          activeOpacity={1}
          onLongPress={() => onDelete(item.id)}
        >
          <Image
            source={{ uri: item.thumbnail }}
            style={[s.recentArt, item.type === 'artist' && { borderRadius: 22 }]}
            contentFit="cover"
            transition={200}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.recentTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.recentArtist} numberOfLines={1}>
              {item.subtitle || item.type.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            style={s.recentDelete}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close" size={14} color={C.dim} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Glass>
    </Animated.View>
  );
};

// ── Top Result Card ────────────────────────────────────────────────────────
const TopResultCard = ({ song, label, onPlay, goArtistByName, delay = 0 }: any) => {
  const h = useHeart();
  const p = useP();
  const pb = useP();
  
  return (
    <Mat delay={delay}>
      <View style={s.section}>
        <SectionHead title="Top Result" />
        <Animated.View style={{ transform: [{ scale: p.sc }] }}>
          <Glass style={s.topCard} r={28} blur={60}>
            {/* accent tint */}
            <LinearGradient
              colors={[
                h2r(C.primaryMid, 0.2),
                h2r(C.primaryDp, 0.1),
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <TouchableOpacity
              style={s.topInner}
              onPressIn={p.onIn}
              onPressOut={p.onOut}
              onPress={() => onPlay(song)}
              activeOpacity={1}
              onLongPress={() => goArtistByName(song.artist)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${song.title} by ${song.artist}`}
            >
              {/* art */}
              <View style={s.topArtWrapper}>
                <Image
                  source={{ uri: song.art || song.thumbnail }}
                  style={s.topArt}
                  contentFit="cover"
                  transition={300}
                />
                {/* glass ring */}
                <View
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 20,
                    right: 20,
                    height: 1.5,
                    backgroundColor: "rgba(255,255,255,0.22)",
                  }}
                />
                {/* glow */}
                <View style={s.topArtGlow} />
              </View>

              {/* info */}
              <View style={s.topInfo}>
                <View style={s.topLabelRow}>
                  <View style={s.topLabelPill}>
                    <BlurView
                      intensity={40}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: h2r(C.accent, 0.3),
                        backgroundColor: h2r(C.accent, 0.08),
                      }}
                    />
                    <Text style={s.topLabel}>{label || song.label || "BEST MATCH  •  SONG"}</Text>
                  </View>
                </View>
                <Text style={s.topTitle}>{song.title}</Text>
                <TouchableOpacity
                  onPress={() => goArtistByName(song.artist)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${song.artist}`}
                >
                  <Text style={s.topArtist}>{song.artist}</Text>
                </TouchableOpacity>

                {/* action row */}
                <View style={s.topActions}>
                  {/* play btn — full glass */}
                  <Animated.View
                    style={{
                      transform: [{ scale: pb.sc }],
                      flex: 1,
                    }}
                  >
                    <TouchableOpacity
                      style={s.topPlayBtn}
                      onPressIn={pb.onIn}
                      onPressOut={pb.onOut}
                      onPress={() => onPlay(song)}
                      activeOpacity={1}
                    >
                      <LinearGradient
                        colors={[C.primary, C.primaryMid, C.primaryDp]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View
                        style={{
                          position: "absolute",
                          top: 3,
                          left: 16,
                          right: 16,
                          height: 2.5,
                          borderRadius: 2,
                          backgroundColor: "rgba(255,255,255,0.28)",
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          left: 8,
                          top: 6,
                          width: 20,
                          bottom: 6,
                          borderRadius: 8,
                          backgroundColor: "rgba(255,255,255,0.15)",
                          transform: [{ skewX: "-8deg" }],
                        }}
                      />
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.18)",
                        }}
                      />
                      <Ionicons
                        name="play"
                        size={18}
                        color="#FFF"
                        style={{ marginLeft: 3, zIndex: 2 }}
                      />
                      <Text style={s.topPlayText}>Play Now</Text>
                    </TouchableOpacity>
                  </Animated.View>

                  {/* heart */}
                  <Animated.View
                    style={{ transform: [{ scale: h.sc }] }}
                  >
                    <TouchableOpacity
                      style={s.topIconBtn}
                      onPress={h.toggle}
                    >
                      <BlurView
                        intensity={40}
                        tint="dark"
                        style={StyleSheet.absoluteFill}
                      />
                      <View
                        style={{
                          ...StyleSheet.absoluteFillObject,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: h.liked
                            ? h2r(C.primary, 0.45)
                            : C.border,
                        }}
                      />
                      <Ionicons
                        name={
                          h.liked ? "heart" : "heart-outline"
                        }
                        size={20}
                        color={h.liked ? C.primary : C.text}
                      />
                    </TouchableOpacity>
                  </Animated.View>

                  {/* download */}
                  <TouchableOpacity
                    style={s.topIconBtn}
                    onPress={() =>
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light,
                      )
                    }
                  >
                    <BlurView
                      intensity={40}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        borderRadius: 24,
                        borderWidth: 1,
                        borderColor: C.border,
                      }}
                    />
                    <Ionicons
                      name="download-outline"
                      size={20}
                      color={C.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </Glass>
        </Animated.View>
      </View>
    </Mat>
  );
};

// ── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { goNowPlaying, goArtist, goArtistByName, goAlbum } =
    useMusicNavigation("search");
  const { setQueue, preloadTrack } = useMusic();

  const { query: initialQuery } = useLocalSearchParams<{ query?: string }>();
  const { query, setQuery, results, isLoading, error } = useSearch(
    initialQuery || "",
  );

  const { 
    recentSearches, 
    loadRecentSearches, 
    addRecentSearch, 
    removeRecentSearch, 
    clearRecentSearches 
  } = useRecentSearchStore();

  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  const [topLiked, setTopLiked] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const SEARCH_CATEGORIES = ["All", "Songs", "Artists", "Albums"];

  // animated bg
  const bgP = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgP, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(bgP, {
          toValue: 2,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(bgP, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  const b1Op = bgP.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.13, 0.2, 0.1],
  });
  const b2Op = bgP.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.08, 0.14, 0.17],
  });
  const b1T = bgP.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 30, -10],
  }); // Pulse translateY
  const b2T = bgP.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -20, 10],
  }); // Pulse translateY

  const createPlayerTrack = (track: any): PlayerTrack => {
    const url =
      track.url ??
      TRACK_URLS[track.id] ??
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    return {
      id: track.id,
      title: track.title ?? "",
      artist: track.artist ?? "",
      art: track.art || track.thumbnail || "",
      url,
      duration: 240,
      dominantColors: [C.primary, C.primaryMid],
    };
  };

  const handlePlay = useCallback(
    async (track: MusicTrack) => {
      if (!track?.id) return;
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // PRELOAD: Resolve stream URL before navigation to avoid blank player
      const playerTrack = createPlayerTrack(track);
      await preloadTrack(playerTrack);
      
      // Navigate once resolved
      goNowPlaying(track.id);

      const trackList = (results?.songs?.length ?? 0) > 0 ? results.songs : [track];
      const playerTracks = trackList.map((t) => createPlayerTrack(t));
      const startIndex = playerTracks.findIndex((t) => t.id === track.id);

      console.log(
        "[Player] Search selected track from list (Post-Preload Nav):",
        track.id,
        "Index:",
        startIndex
      );

      // Start queue resolution (will use the preloaded track)
      setQueue(playerTracks, startIndex !== -1 ? startIndex : 0).catch(err => {
        console.error("[Player] Background setQueue failed:", err);
      });
    },
    [goNowPlaying, setQueue, results, preloadTrack],
  );

  const handlePlaySong = useCallback(
    async (song: any) => {
      // Add to recent
      addRecentSearch({
        id: song.id,
        type: "song",
        title: song.title,
        subtitle: song.artist,
        thumbnail: song.art || song.thumbnail || "",
        data: song,
      });
      
      handlePlay({
        id: song.id,
        title: song.title,
        artist: song.artist || "",
        art: song.art || song.thumbnail || "",
      });
    },
    [addRecentSearch, handlePlay],
  );

  const handlePressArtist = useCallback(
    (artist: any) => {
      addRecentSearch({
        id: artist.id,
        type: "artist",
        title: artist.name || artist.title,
        subtitle: "Artist",
        thumbnail: artist.art || artist.thumbnail || "",
        data: artist,
      });
      goArtist(artist.id);
    },
    [addRecentSearch, goArtist],
  );

  const handlePressAlbum = useCallback(
    (album: any) => {
      addRecentSearch({
        id: album.id,
        type: "album",
        title: album.title,
        subtitle: album.artist || "Album",
        thumbnail: album.art || album.thumbnail || "",
        data: album,
      });
      goAlbum(album.id);
    },
    [addRecentSearch, goAlbum],
  );

  const handleRecentPress = useCallback(
    async (item: RecentSearchItem) => {
      if (item.type === "song") {
        handlePlay({
          id: item.id,
          title: item.title,
          artist: item.subtitle || "",
          art: item.thumbnail,
        });
      } else if (item.type === "artist") {
        goArtist(item.id);
      } else if (item.type === "album") {
        goAlbum(item.id);
      }
    },
    [handlePlay, goArtist, goAlbum],
  );

  const handleDeleteRecent = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    removeRecentSearch(id);
  }, [removeRecentSearch]);

  const hasResults = !results?.isEmpty && (
    (results?.songs?.length ?? 0) > 0 ||
    (results?.artists?.length ?? 0) > 0 ||
    (results?.albums?.length ?? 0) > 0 ||
    (results?.playlists?.length ?? 0) > 0
  );

  // Fuzzy match similarity function (Levenshtein-based)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) {
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      return shorter.length / longer.length;
    }
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
  };

  // Use unified search results from hook - already has topResult calculated
  const exactMatchSong = results?.topResult;
  const remainingSongs = results?.songs || [];
  const filteredArtists = results?.artists || [];
  const filteredAlbums = results?.albums || [];
  const filteredPlaylists = results?.playlists || [];

  // Category-filtered results
  const categoryFilteredSongs = useMemo(() => {
    if (activeCategory === "All" || activeCategory === "Songs") {
      // Remove top result from songs list if it's a song
      if (exactMatchSong?.type === 'song') {
        return remainingSongs.filter(s => s.id !== exactMatchSong.id);
      }
      return remainingSongs;
    }
    return [];
  }, [activeCategory, remainingSongs, exactMatchSong]);

  const categoryFilteredArtists = useMemo(() => {
    if (activeCategory === "All" || activeCategory === "Artists") {
      // Remove top result if it's an artist
      if (exactMatchSong?.type === 'artist') {
        return filteredArtists.filter(a => a.id !== exactMatchSong.id);
      }
      return filteredArtists;
    }
    return [];
  }, [activeCategory, filteredArtists, exactMatchSong]);

  const categoryFilteredAlbums = useMemo(() => {
    if (activeCategory === "All" || activeCategory === "Albums") {
      return filteredAlbums;
    }
    return [];
  }, [activeCategory, filteredAlbums]);

  const categoryFilteredPlaylists = useMemo(() => {
    if (activeCategory === "All" || activeCategory === "Playlists") {
      return filteredPlaylists;
    }
    return [];
  }, [activeCategory, filteredPlaylists]);

  // Show sections based on category
  const showSongsSection = activeCategory === "All" || activeCategory === "Songs";
  const showArtistsSection = activeCategory === "All" || activeCategory === "Artists";
  const showAlbumsSection = activeCategory === "All" || activeCategory === "Albums";

  return (
    <View style={s.root}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* ── ANIMATED BG ──────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <Animated.View
          style={[
            s.blob,
            {
              width: SW * 0.85,
              height: SW * 0.85,
              backgroundColor: "#2a0053",
              transform: [{ translateX: -SW * 0.25 }, { translateY: b1T }],
              opacity: b1Op,
            },
          ]}
        />
        <Animated.View
          style={[
            s.blob,
            {
              width: SW * 0.65,
              height: SW * 0.65,
              backgroundColor: "#003731",
              transform: [{ translateX: SW * 0.22 }, { translateY: b2T }],
              opacity: b2Op,
            },
          ]}
        />
        <Animated.View
          style={[
            s.blob,
            {
              width: SW * 0.45,
              height: SW * 0.45,
              backgroundColor: "#1a0038",
              left: "-8%",
              bottom: "40%",
              opacity: bgP.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [0.05, 0.12, 0.08],
              }),
            },
          ]}
        />
        <LinearGradient
          colors={[
            "rgba(8,8,13,0.0)",
            "rgba(8,8,13,0.55)",
            "rgba(8,8,13,0.93)",
          ]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + (isTablet ? 28 : 20) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <Mat delay={0}>
          <View style={s.header}>
            <View style={s.headerRow}>
              <Ionicons
                name="search"
                size={26}
                color={C.primary}
                style={{
                  ...Platform.select({
                    ios: {
                      shadowColor: C.primary,
                      shadowRadius: 8,
                      shadowOpacity: 0.7,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  }),
                }}
              />
              <Text style={s.headerTitle}>Search</Text>
            </View>
          </View>
        </Mat>

        {/* ── SEARCH BAR ─────────────────────────────────────────────── */}
        <Mat delay={60}>
          <Glass style={s.searchBar} r={30} blur={65}>
            <Ionicons
              name="search"
              size={19}
              color={C.dim}
              style={{ marginLeft: 18, marginRight: 6 }}
            />
            <TextInput
              style={s.searchInput}
              placeholder="Search songs, artists, lyrics..."
              placeholderTextColor={C.dim}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                style={{ paddingRight: 16 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={19} color={C.dim} />
              </TouchableOpacity>
            )}
          </Glass>
        </Mat>

        {/* ── CATEGORY FILTER BAR ───────────────────────────────────── */}
        {query.trim().length > 0 && (
          <Mat delay={80}>
            <CategoryTabs
              categories={SEARCH_CATEGORIES}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </Mat>
        )}

        {/* ═══════════════════════════════════════════════════════════
            EMPTY STATE (no query)
        ═══════════════════════════════════════════════════════════ */}
        {query.length === 0 && (
          <>
            {/* Recently Searched */}
            {recentSearches.length > 0 ? (
              <Mat delay={120}>
                <View style={s.section}>
                  <View style={s.secHeaderRow}>
                    <SectionHead title="Recently Searched" />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        clearRecentSearches();
                      }}
                    >
                      <Text style={s.clearText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.recentGrid}>
                    {recentSearches.map((item) => (
                      <RecentItem
                        key={item.id}
                        item={item}
                        onPress={handleRecentPress}
                        onDelete={handleDeleteRecent}
                      />
                    ))}
                  </View>
                </View>
              </Mat>
            ) : (
              <Mat delay={120}>
                <View style={s.noResultsWrap}>
                  <Ionicons name="time-outline" size={48} color={C.dim} />
                  <Text style={s.noResultsTitle}>Search Memory</Text>
                  <Text style={s.noResultsSub}>
                    Your recent searches will appear here.
                  </Text>
                </View>
              </Mat>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SEARCH RESULTS
        ═══════════════════════════════════════════════════════════ */}
        {query.length > 0 && (
          <>
            {isLoading ? (
              <View style={[s.section, { marginTop: 16 }]}>
                <Mat delay={0}>
                  <SectionHead title="Searching..." />
                </Mat>
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <View key={i} style={{ marginBottom: 10 }}>
                    <SkeletonRow delay={100 + i * 50} />
                  </View>
                ))}
              </View>
            ) : error ? (
              <Mat delay={0}>
                <View style={s.noResultsWrap}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={52}
                    color={C.primary}
                  />
                  <Text style={s.noResultsTitle}>Connection Error</Text>
                  <Text style={s.noResultsSub}>{error}</Text>
                  <TouchableOpacity
                    style={[s.followBtn, { marginTop: 20 }]}
                    onPress={() => setQuery(query)} // Trigger retry
                  >
                    <LinearGradient
                      colors={[C.primary, C.primaryMid]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={[s.followText, { color: "#FFF" }]}>
                      Retry Search
                    </Text>
                  </TouchableOpacity>
                </View>
              </Mat>
            ) : !hasResults ? (
              <Mat delay={0}>
                <View style={s.noResultsWrap}>
                  <Ionicons name="search-outline" size={52} color={C.dim} />
                  <Text style={s.noResultsTitle}>No results found</Text>
                  <Text style={s.noResultsSub}>
                    Try a different song, artist, or keyword
                  </Text>
                </View>
              </Mat>
            ) : (
              <>
                <Mat delay={0}>
                  <Text style={[s.resultsFor]}>
                    Results for{" "}
                    <Text style={{ color: C.primary }}>{`"${query}"`}</Text>
                  </Text>
                </Mat>

                {/* Exact Match Top Result Card - only show for Songs/All category */}
                {exactMatchSong && (activeCategory === "All" || activeCategory === "Songs") && (
                  <TopResultCard
                    song={exactMatchSong}
                    onPlay={handlePlaySong}
                    goArtistByName={goArtistByName}
                    delay={40}
                  />
                )}

                {/* Songs Section */}
                {showSongsSection && categoryFilteredSongs.length > 0 && (
                  <>
                    <Mat delay={60}>
                      <View style={[s.section, { marginTop: exactMatchSong && exactMatchSong.type === 'song' ? 20 : 16 }]}>
                        <SectionHead title={exactMatchSong && exactMatchSong.type === 'song' ? "Related Songs" : "Songs"} />
                      </View>
                    </Mat>
                    <View style={[s.section, { marginTop: -8 }]}>
                      {categoryFilteredSongs.map((song, idx) => (
                        <View key={`song-${song.id}-${idx}`} style={{ marginBottom: 10 }}>
                          <SongRow
                            song={{ id: song.id, title: song.title, artist: song.artist || '', time: song.duration || '', art: song.art || '' }}
                            onPlay={handlePlaySong}
                            delay={80 + idx * 35}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {showArtistsSection && categoryFilteredArtists.length > 0 && (
                  <>
                    <Mat delay={80}>
                      <View style={s.section}>
                        <SectionHead title="Artists" accent />
                      </View>
                    </Mat>
                    <View style={[s.section, { marginTop: -8 }]}>
                      {categoryFilteredArtists.map((artist, idx) => (
                        <View key={artist.id} style={{ marginBottom: 10 }}>
                          <ArtistRow
                            artist={{ id: artist.id, name: artist.title, art: artist.art || '', followers: artist.subscribers || '' }}
                            delay={100 + idx * 50}
                            onPress={() => handlePressArtist(artist)}
                          />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {showAlbumsSection && categoryFilteredAlbums.length > 0 && (
                  <>
                    <Mat delay={120}>
                      <View style={s.section}>
                        <SectionHead title="Albums" />
                      </View>
                    </Mat>
                    <Mat delay={140}>
                      <View style={[s.albumGrid, { marginBottom: 40 }]}>
                        {categoryFilteredAlbums.map((album, idx) => (
                          <AlbumCard
                            key={album.id}
                            album={{ id: album.id, title: album.title, art: album.art || '' }}
                            delay={160 + idx * 50}
                            onPress={() => handlePressAlbum(album)}
                          />
                        ))}
                      </View>
                    </Mat>
                  </>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: "absolute", borderRadius: SW * 0.5 },
  scroll: { paddingHorizontal: PAD },

  header: { marginBottom: 22 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: {
    fontSize: isTablet ? 34 : 28,
    fontWeight: "800",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: -0.5,
  },

  // search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 54,
    marginBottom: 32,
  },
  searchInput: {
    flex: 1,
    color: C.text,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },

  // sections
  section: { marginBottom: 8 },
  secHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  secHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  secAccentBar: { width: 4, height: 20, borderRadius: 2 },
  secTitle: {
    fontSize: isTablet ? 22 : 19,
    fontWeight: "800",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: -0.3,
  },
  clearText: { fontSize: 13, fontWeight: "700", color: C.primary },

  // recently searched
  recentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  recentCard: {},
  recentInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
  },
  recentArt: { width: 44, height: 44, borderRadius: 10 },
  recentTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  recentArtist: { fontSize: 11, color: C.muted, marginTop: 2 },
  recentDelete: { padding: 4 },

  // top result card
  topCard: {},
  topInner: { padding: 22 },
  topArtWrapper: {
    width: SW * 0.56,
    aspectRatio: 1,
    borderRadius: 22,
    alignSelf: "center",
    marginBottom: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: { elevation: 18 },
    }),
  },
  topArt: { width: "100%", height: "100%", borderRadius: 22 },
  topArtGlow: {
    position: "absolute",
    bottom: -14,
    left: "20%",
    right: "20%",
    height: 28,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowRadius: 16,
        shadowOpacity: 0.55,
        shadowOffset: { width: 0, height: 0 },
      },
    }),
  },
  topLabelRow: { flexDirection: "row", marginBottom: 10 },
  topLabelPill: {
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: C.accent,
    letterSpacing: 1.4,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  topInfo: {},
  topTitle: {
    fontSize: isTablet ? 34 : 28,
    fontWeight: "900",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  topArtist: {
    fontSize: 17,
    color: C.muted,
    fontWeight: "500",
    marginBottom: 22,
  },
  topActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  topPlayBtn: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      },
      android: { elevation: 10 },
    }),
  },
  topPlayText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFF",
    zIndex: 2,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  topIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },

  // songs
  songCard: {},
  songInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 14,
  },
  songArt: {
    width: isTablet ? 58 : 50,
    height: isTablet ? 58 : 50,
    borderRadius: 11,
  },
  songMeta: { flex: 1 },
  songTitle: {
    fontSize: isTablet ? 16 : 15,
    fontWeight: "700",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  songArtist: { fontSize: 12, color: C.muted, marginTop: 3 },
  songTime: {
    fontSize: 12,
    color: C.dim,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginRight: 4,
  },
  iconSmall: { padding: 4 },

  // artists
  artistCard: {},
  artistInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 14,
  },
  artistAvatarWrap: { position: "relative" },
  artistAvatar: {
    width: isTablet ? 60 : 54,
    height: isTablet ? 60 : 54,
    borderRadius: isTablet ? 30 : 27,
  },
  artistAvatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: isTablet ? 30 : 27,
    borderWidth: 1.5,
    borderColor: h2r("#BF5AF2", 0.4),
  },
  artistMeta: { flex: 1 },
  artistName: {
    fontSize: isTablet ? 17 : 15,
    fontWeight: "700",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  artistFollowers: {
    fontSize: 12,
    color: C.accent,
    fontWeight: "600",
    marginTop: 3,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  followText: { fontSize: 13, fontWeight: "700", color: C.primary, zIndex: 2 },

  // albums
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  albumArtWrap: {
    marginBottom: 10,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    paddingHorizontal: 2,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },

  // no results
  noResultsWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-medium",
  },
  noResultsSub: { fontSize: 14, color: C.muted, textAlign: "center" },

  // results label
  resultsFor: {
    fontSize: 17,
    fontWeight: "600",
    color: C.muted,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },
});

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  StatusBar,
  Share,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMusic } from '@/src/context/MusicContext';
import { useMusicNavigation } from '@/src/navigation/music-navigation';

const { width: SW, height: SH } = Dimensions.get('window');
const PAD = 24;

// ── DESIGN TOKENS ──────────────────────────────────────────────────────────
const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  accentAlt: '#00D4FF',
  amber: '#FFD700',
  bg: '#131318',
  surface: 'rgba(28,28,32,0.6)',
  surfaceDeep: 'rgba(20,20,24,0.8)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  textMuted: '#8B8795',
  textSecondary: '#CBC3D9',
};

const SP = { tension: 65, friction: 10 }; // Spring physics

// ── UTILITIES ──────────────────────────────────────────────────────────────
const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── ANIMATED GRADIENT BACKGROUND ───────────────────────────────────────────
const AnimatedGradientBackground = () => {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 8000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const color1 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(42, 0, 83, 0.35)', 'rgba(70, 50, 120, 0.3)', 'rgba(42, 0, 83, 0.35)'],
  });

  const color2 = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(26, 35, 126, 0.25)', 'rgba(26, 100, 150, 0.2)', 'rgba(26, 35, 126, 0.25)'],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
      <Animated.View
        style={[
          s.blob,
          {
            width: 400,
            height: 400,
            transform: [
              { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [-100, -50] }) },
              { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [-100, -120] }) }
            ],
            backgroundColor: 'rgba(42, 0, 83, 0.35)', // Static color for native performance
            opacity: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.45, 0.35] })
          },
        ]}
      />
      <Animated.View
        style={[
          s.blob,
          {
            width: 300,
            height: 300,
            transform: [
              { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [SW * 0.7, SW * 0.8] }) },
              { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [100, 150] }) }
            ],
            backgroundColor: 'rgba(26, 35, 126, 0.25)',
            opacity: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.35, 0.25] })
          },
        ]}
      />
      <View
        style={[
          s.blob,
          {
            width: 250,
            height: 250,
            bottom: -50,
            left: '50%',
            backgroundColor: 'rgba(70, 245, 224, 0.08)',
          },
        ]}
      />
    </View>
  );
};

// ── PREMIUM GLASS COMPONENT ────────────────────────────────────────────────
const PremiumGlass = ({
  children,
  style,
  r = 24,
  blur = 60,
  gloss = true,
  gradient = false,
}: any) => {
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />

      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: C.surface,
            borderRadius: r,
          },
        ]}
      />

      {gloss && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: r * 0.3,
            right: r * 0.3,
            height: 1.5,
            backgroundColor: 'rgba(255,255,255,0.25)',
            borderRadius: r,
            zIndex: 5,
          }}
        />
      )}

      {gloss && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 6,
            top: 10,
            bottom: 10,
            width: 2.5,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 2,
            zIndex: 4,
          }}
        />
      )}

      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: r,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          backgroundColor: 'rgba(255,255,255,0.02)',
          zIndex: 3,
        }}
      />

      {gradient && (
        <LinearGradient
          colors={['rgba(191,90,242,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: r, zIndex: 2 }]}
          pointerEvents="none"
        />
      )}

      <View style={{ zIndex: 1 }}>{children}</View>
    </View>
  );
};

// ── MATERIAL ENTRANCE ANIMATION ────────────────────────────────────────────
const MaterialEntrance = ({ children, delay = 0, style }: any) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, ...SP, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <Animated.View style={[{ opacity: op, transform: [{ translateY: ty }] }, style]}>
      {children}
    </Animated.View>
  );
};

// ── INTERACTIVE HEART BUTTON ───────────────────────────────────────────────
const HeartButton = ({ liked = false, onPress, size = 24 }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.7, duration: 100, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: -20, duration: 100, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.2, ...SP, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 20, duration: 100, useNativeDriver: true }),
      ]),
      Animated.spring(rotation, { toValue: 0, ...SP, useNativeDriver: true }),
    ]).start();

    onPress?.();
  }, []);

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View
        style={{
          transform: [
            { scale },
            {
              rotate: rotation.interpolate({
                inputRange: [-20, 0, 20],
                outputRange: ['-20deg', '0deg', '20deg'],
              }),
            },
          ],
        }}
      >
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? '#FF1744' : C.textSecondary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── DOWNLOAD BUTTON WITH PROGRESS ──────────────────────────────────────────
const DownloadButton = ({ downloaded = false, onPress, downloading = false }: any) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (downloading) {
      Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [downloading]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  }, []);

  const rotationValue = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (downloading) {
    return (
      <Animated.View style={{ transform: [{ rotate: rotationValue }] }}>
        <Ionicons name="download" size={24} color={C.accent} />
      </Animated.View>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons
        name={downloaded ? 'checkmark-circle' : 'cloud-download-outline'}
        size={24}
        color={downloaded ? C.accent : C.textSecondary}
      />
    </TouchableOpacity>
  );
};

// ── HORIZONTAL TRACK CARD (FIXED) ──────────────────────────────────────────
const TrackCard = ({ title, artist, image, onPress, onArtistPress, liked, onLikePress, downloaded, onDownload, variant = 'compact' }: any) => {
  const [isLiked, setIsLiked] = useState(liked);
  const [isDownloading, setIsDownloading] = useState(false);
  const isCompact = variant === 'compact';

  const handleCardPress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.7}
      style={[s.trackCardContainer, isCompact ? s.trackCardContainerCompact : s.trackCardContainerExpanded]}
    >
      <PremiumGlass r={16} blur={50} gloss style={[s.trackCardGlass, isCompact ? s.trackCardGlassCompact : s.trackCardGlassExpanded]}>
        <Image source={{ uri: image }} style={[s.trackCardImage, isCompact ? s.trackCardImageCompact : s.trackCardImageExpanded]} contentFit="cover" />
        <View style={s.trackCardContent}>
          <Text style={[s.trackCardTitle, isCompact && s.trackCardTitleCompact]} numberOfLines={2}>
            {title}
          </Text>
          <TouchableOpacity onPress={(e) => {
            e.stopPropagation();
            onArtistPress?.();
          }}>
            <Text style={s.trackCardArtist} numberOfLines={isCompact ? 2 : 1}>
              {artist}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[s.trackCardActions, isCompact && s.trackCardActionsCompact]}>
          <HeartButton
            liked={isLiked}
            size={20}
            onPress={() => {
              setIsLiked(!isLiked);
              onLikePress?.();
            }}
          />
          <DownloadButton
            downloaded={downloaded}
            downloading={isDownloading}
            onPress={() => {
              setIsDownloading(true);
              setTimeout(() => setIsDownloading(false), 1500);
              onDownload?.();
            }}
          />
        </View>
      </PremiumGlass>
    </TouchableOpacity>
  );
};

// ── BENTO CARD (LARGE FEATURED) ────────────────────────────────────────────
const BentoCard = ({
  image,
  title,
  subtitle,
  tag,
  onPress,
}: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.bentoCard}
    >
      <PremiumGlass r={32} blur={70} gloss gradient style={s.bentoCardGlass}>
        <Image source={{ uri: image }} style={s.bentoCardImage} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.bentoCardContent}>
          {tag && (
            <View style={s.bentoCardTag}>
              <Text style={s.bentoCardTagText}>{tag}</Text>
            </View>
          )}
          <Text style={s.bentoCardTitle}>{title}</Text>
          <Text style={s.bentoCardSubtitle}>{subtitle}</Text>
        </View>
      </PremiumGlass>
    </TouchableOpacity>
  );
};

// ── CIRCULAR ARTIST CARD ───────────────────────────────────────────────────
const CircleArtistCard = ({ name, image, onPress }: any) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={s.circleArtistContainer}
    >
      <PremiumGlass r={64} blur={60} gloss style={s.circleArtistGlass}>
        <Image source={{ uri: image }} style={s.circleArtistImage} contentFit="cover" />
      </PremiumGlass>
      <Text style={s.circleArtistName} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

// ── SWIPEABLE HERO CARD ────────────────────────────────────────────────────
const SwipeableHeroCard = ({ albums, onPlay }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardWidth = SW - PAD * 2;

  return (
    <View style={s.heroCard}>
      <ScrollView
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / cardWidth);
          if (index !== currentIndex) {
            setCurrentIndex(index);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
      >
        {albums.map((album: any) => (
          <View key={album.id} style={[s.heroSlide, { width: cardWidth }]}>
            <Image source={{ uri: album.image }} style={s.heroImage} contentFit="cover" contentPosition="center" />
            <LinearGradient
              colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0.82)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={s.heroBottom}>
              <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={s.heroInfo}>
                <Text style={s.heroTitle}>{album.title}</Text>
                <Text style={s.heroSubtitle}>{album.artist}</Text>
              </View>

              <View style={s.heroControls}>
                <View style={s.pagination}>
                  {albums.map((_: any, i: number) => (
                    <View
                      key={i}
                      style={[
                        s.paginationDot,
                        currentIndex === i && s.paginationDotActive,
                      ]}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    onPlay?.(album);
                  }}
                  activeOpacity={0.8}
                  style={s.heroPlayButton}
                >
                  <LinearGradient
                    colors={[h2r('#BF5AF2', 0.9), h2r('#9B38DA', 1)]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons name="play" size={32} color={C.text} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

// ── SECTION HEADER ─────────────────────────────────────────────────────────
const SectionHeader = ({ title, onSeeAll }: any) => (
  <View style={s.sectionHeader}>
    <Text style={s.sectionTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
        <Text style={s.seeAllText}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ── MAIN HOME SCREEN ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { goNowPlaying, goArtist, goPlaylist, goAlbum } = useMusicNavigation('home');
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [downloadedSongs, setDownloadedSongs] = useState<Set<string>>(new Set());
  const [expandedContinueListening, setExpandedContinueListening] = useState(false);

  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { title: 'Good morning', sub: 'Rise and shine for some morning beats.' };
    } else if (hour >= 12 && hour < 17) {
      return { title: 'Good afternoon', sub: 'Keep the energy up with some mid-day vibes.' };
    } else if (hour >= 17 && hour < 21) {
      return { title: 'Good evening', sub: 'Ready for some evening vibes?' };
    } else {
      return { title: 'Good night', sub: 'Wind down with some midnight melodies.' };
    }
  }, []);

  const albums = [
    {
      id: 'neon-echoes',
      title: 'Neon Dreams',
      artist: 'The Midnight Syndicate • New Release',
      image: 'https://picsum.photos/400/400?random=7',
    },
    {
      id: 'a3',
      title: 'Echoes of Silence',
      artist: 'Lumina Flux • 2024',
      image: 'https://picsum.photos/400/400?random=8',
    },
    {
      id: 'solaris',
      title: 'Urban Jungle',
      artist: 'Concrete Beats • Trending',
      image: 'https://picsum.photos/400/400?random=9',
    },
  ];

  const tracks = [
    { id: 'nebula', title: 'Echoes of Silence', artist: 'Lumina Flux', artistId: '1', image: 'https://picsum.photos/300/300?random=1' },
    { id: 'neon', title: 'Urban Jungle', artist: 'Concrete Beats', artistId: 'elara', image: 'https://picsum.photos/300/300?random=2' },
    { id: 'solar', title: 'Neon Dreams', artist: 'The Midnight Syndicate', artistId: 'elara', image: 'https://picsum.photos/300/300?random=3' },
    { id: 'cosmic', title: 'Cosmic Wave', artist: 'Digital Echo', artistId: '2', image: 'https://picsum.photos/300/300?random=10' },
    { id: 'midnight', title: 'Midnight Flow', artist: 'Luna Ray', artistId: '2', image: 'https://picsum.photos/300/300?random=11' },
  ];
  const trackUrls: Record<string, string> = {
    nebula: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    neon: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    solar: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    cosmic: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    midnight: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    '1': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    '2': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    '3': 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  };

  const artists = [
    { id: '1', name: 'Solstice', image: 'https://picsum.photos/300/300?random=4' },
    { id: '2', name: 'Luna Ray', image: 'https://picsum.photos/300/300?random=5' },
    { id: 'elara', name: 'Elara Vance', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVPNWk1tlfHYyyWTBZhwh81Z6py-WVfUuxGVj51H72sBRafC8YphQ6KN32w47mVX4Vc_Gilgd9z97W25tKGqRujSEIq2yStVYqau9IUi6SHp1oWk4cXmYzmyTW3FjDYeBq6PdVhXaO0tAWivGBf42atMriqBRDwDtZarzZFB8CXSe6nZ2p5F-dWmhBrdH-IMd3mhHX3Thcn_9L_5R7nIJdFSM0Rglel2NhCZiTz9FL4EQBpTBZwwMZTDDbA8vKdPQ3ErzWfZi8Lqw' },
  ];

  const playlistsData = [
    {
      id: 'p1',
      title: 'Daily Mix 1',
      image: 'https://picsum.photos/400/300?random=8',
      tag: 'PERSONALIZED',
      subtitle: 'Experimental pop, synthwave, and indie electronic just for you.',
    },
    {
      id: 'p2',
      title: 'Focus Flow',
      image: 'https://picsum.photos/400/300?random=9',
      subtitle: 'Deep ambient for concentration.',
    },
    {
      id: 'p3',
      title: 'Chill Vibes',
      image: 'https://picsum.photos/400/300?random=12',
      subtitle: 'Relaxing sounds for your mood.',
    },
  ];

  const { setTrack } = useMusic();

  const handlePlayPress = useCallback((track: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTrack({
      id: track.id,
      url: trackUrls[track.id] ?? 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
      title: track.title,
      artist: track.artist,
      art: track.image,
      durationSec: 240,
      dominantColors: ['#bf5af2', '#1a0033'],
    });
    goNowPlaying(track.id);
  }, [goNowPlaying, setTrack]);

  const displayedTracks = expandedContinueListening ? tracks : tracks.slice(0, 2);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Animated Gradient Background */}
      <AnimatedGradientBackground />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 10, paddingBottom: 180 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Welcome Section */}
        <MaterialEntrance delay={0}>
          <View style={s.welcomeSection}>
            <Text style={s.welcomeTitle}>{greetingData.title}</Text>
            <Text style={s.welcomeSubtitle}>{greetingData.sub}</Text>
          </View>
        </MaterialEntrance>

        {/* Swipeable Hero Featured Cards */}
        <MaterialEntrance delay={100}>
          <SwipeableHeroCard albums={albums} onPlay={handlePlayPress} />
        </MaterialEntrance>

        {/* Continue Listening */}
        <MaterialEntrance delay={200}>
          <SectionHeader
            title="Continue Listening"
            onSeeAll={() => {
              setExpandedContinueListening(!expandedContinueListening);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          />
          <ScrollView
            horizontal
            contentInsetAdjustmentBehavior="automatic"
            showsHorizontalScrollIndicator={false}
            style={s.hzScroll}
            scrollEnabled={!expandedContinueListening}
          >
            {displayedTracks.map((track) => (
              <TrackCard
                key={track.id}
                title={track.title}
                artist={track.artist}
                image={track.image}
                variant="compact"
                onPress={() => handlePlayPress(track)}
                onArtistPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  goArtist(track.artistId || 'elara');
                }}
                liked={likedSongs.has(track.id)}
                onLikePress={() => {
                  const newLiked = new Set(likedSongs);
                  if (newLiked.has(track.id)) {
                    newLiked.delete(track.id);
                  } else {
                    newLiked.add(track.id);
                  }
                  setLikedSongs(newLiked);
                }}
                downloaded={downloadedSongs.has(track.id)}
                onDownload={() => {
                  const newDownloaded = new Set(downloadedSongs);
                  newDownloaded.add(track.id);
                  setDownloadedSongs(newDownloaded);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              />
            ))}
          </ScrollView>

          {/* Show as vertical list when expanded */}
          {expandedContinueListening && (
            <View style={s.expandedListContainer}>
              {tracks.slice(2).map((track) => (
                <TrackCard
                  key={track.id}
                  title={track.title}
                  artist={track.artist}
                  image={track.image}
                  variant="row"
                  onPress={() => handlePlayPress(track)}
                  onArtistPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    goArtist(track.artistId || 'elara');
                  }}
                  liked={likedSongs.has(track.id)}
                  onLikePress={() => {
                    const newLiked = new Set(likedSongs);
                    if (newLiked.has(track.id)) {
                      newLiked.delete(track.id);
                    } else {
                      newLiked.add(track.id);
                    }
                    setLikedSongs(newLiked);
                  }}
                  downloaded={downloadedSongs.has(track.id)}
                  onDownload={() => {
                    const newDownloaded = new Set(downloadedSongs);
                    newDownloaded.add(track.id);
                    setDownloadedSongs(newDownloaded);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                />
              ))}
            </View>
          )}
        </MaterialEntrance>

        {/* Made For You */}
        <MaterialEntrance delay={300}>
          <View style={s.madeForYouSection}>
            <SectionHeader title="Made For You" />
            {playlistsData.map((playlist) => (
              <BentoCard
                key={playlist.id}
                image={playlist.image}
                tag={playlist.tag}
                title={playlist.title}
                subtitle={playlist.subtitle}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  goPlaylist(playlist.id);
                }}
              />
            ))}
          </View>
        </MaterialEntrance>

        {/* Recently Played Artists */}
        <MaterialEntrance delay={400}>
          <SectionHeader title="Recently Played" />
          <ScrollView horizontal contentInsetAdjustmentBehavior="automatic" showsHorizontalScrollIndicator={false} style={s.artistScroll}>
            {artists.map((artist) => (
              <CircleArtistCard
                key={artist.id}
                name={artist.name}
                image={artist.image}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  goArtist(artist.id);
                }}
              />
            ))}
          </ScrollView>
        </MaterialEntrance>

        {/* Trending Section */}
        <MaterialEntrance delay={500}>
          <SectionHeader title="Trending Now" />
          <ScrollView horizontal contentInsetAdjustmentBehavior="automatic" showsHorizontalScrollIndicator={false} style={s.hzScroll}>
            {albums.map((album) => (
              <View key={album.id} style={{ marginRight: 16 }}>
                <BentoCard
                  image={album.image}
                  title={album.title}
                  subtitle={album.artist}
                  onPress={() => goAlbum(album.id)}
                />
              </View>
            ))}
          </ScrollView>
        </MaterialEntrance>
      </ScrollView>
    </View>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scrollContent: {},
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },

  // Welcome Section
  welcomeSection: {
    paddingHorizontal: PAD,
    marginBottom: 32,
    marginTop: 8,
  },
  welcomeTitle: {
    color: C.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    color: C.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.85,
  },

  // Hero Card
  heroCard: {
    height: 360,
    marginHorizontal: PAD,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: 44,
    backgroundColor: C.surface,
  },
  heroSlide: {
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 138,
    paddingHorizontal: 28,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroInfo: {
    flex: 1,
  },
  heroTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  heroControls: {
    alignItems: 'center',
    gap: 16,
  },
  pagination: {
    flexDirection: 'row',
    gap: 7,
  },
  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  paginationDotActive: {
    backgroundColor: C.text,
    width: 24,
  },
  heroPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.primary,
    shadowRadius: 16,
    shadowOpacity: 0.6,
    elevation: 12,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: PAD,
    marginBottom: 18,
    marginTop: 12,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAllText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 14,
  },

  // Horizontal Scroll
  hzScroll: {
    paddingHorizontal: PAD,
    gap: 16,
    marginBottom: 8,
  },

  // Track Card
  trackCardContainer: {
    marginBottom: 12,
  },
  trackCardContainerCompact: {
    width: 168,
    marginRight: 12,
  },
  trackCardContainerExpanded: {
    width: '100%',
  },
  trackCardGlass: {
    padding: 12,
    gap: 12,
  },
  trackCardGlassCompact: {
    minHeight: 176,
    justifyContent: 'space-between',
  },
  trackCardGlassExpanded: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackCardImage: {
    borderRadius: 12,
  },
  trackCardImageCompact: {
    width: '100%',
    height: 112,
  },
  trackCardImageExpanded: {
    width: 80,
    height: 80,
  },
  trackCardContent: {
    flex: 1,
    minWidth: 0,
  },
  trackCardTitle: {
    color: C.text,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
  },
  trackCardTitleCompact: {
    marginTop: 2,
    marginBottom: 6,
  },
  trackCardArtist: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  trackCardActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  trackCardActionsCompact: {
    justifyContent: 'space-between',
    marginTop: 6,
  },

  // Expanded List
  expandedListContainer: {
    paddingHorizontal: PAD,
    gap: 12,
    marginTop: 16,
  },

  // Bento Card
  madeForYouSection: {
    paddingHorizontal: PAD,
    marginBottom: 44,
    gap: 16,
  },
  bentoCard: {
    width: '100%',
    height: 240,
    marginBottom: 16,
  },
  bentoCardGlass: {
    flex: 1,
  },
  bentoCardImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.84,
  },
  bentoCardContent: {
    flex: 1,
    padding: 28,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5,5,9,0.12)',
  },
  bentoCardTag: {
    backgroundColor: 'rgba(70, 245, 224, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(70, 245, 224, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  bentoCardTagText: {
    color: C.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  bentoCardTitle: {
    color: C.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  bentoCardSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },

  // Circle Artist
  circleArtistContainer: {
    marginRight: 20,
    alignItems: 'center',
  },
  circleArtistGlass: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginBottom: 12,
    overflow: 'hidden',
  },
  circleArtistImage: {
    width: '100%',
    height: '100%',
    borderRadius: 64,
  },
  circleArtistName: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    width: 128,
    textAlign: 'center',
  },

  // Artist Scroll
  artistScroll: {
    paddingHorizontal: PAD,
    marginBottom: 44,
  },
});

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  Share,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMusic } from '@/src/context/MusicContext';
import { openArtistByName } from '@/src/navigation/music-navigation';

const { width, height } = Dimensions.get('window');

// ── Motion constants ──────────────────────────────────────────────────────────
const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 1 };

const formatTime = (sec: number) => {
  'worklet';
  if (isNaN(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ── Liquid Glass Card shell ───────────────────────────────────────────────────
const GlassCard = ({ children, style, borderRadius = 20, blurIntensity = 65 }: any) => (
  <View style={[{
    borderRadius,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  }, style]}>
    <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={{
      position: 'absolute', top: 0, left: borderRadius * 0.4,
      right: borderRadius * 0.4, height: 1.5,
      backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 10,
    }} />
    <View style={{ ...StyleSheet.absoluteFillObject, borderRadius, backgroundColor: 'rgba(255,255,255,0.02)' }} />
    {children}
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NowPlayingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const {
    currentTrack,
    isPlaying,
    isBuffering,
    isLoading,
    progress: globalProgress,
    elapsedSec: globalElapsed,
    durationSec,
    play,
    pause,
    next,
    prev,
    seek,
    toggleRepeat,
    toggleShuffle,
    repeatMode,
    isShuffle,
    setVolume
  } = useMusic();

  const [isLiked, setIsLiked] = useState(true);
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  
  // ── Reanimated Shared Values ────────────────────────────────────────────────
  const scrubberX = useSharedValue(0);
  const scrubberWidth = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  
  const volumeX = useSharedValue(0.65); 
  const volumeWidth = useSharedValue(0);

  const artScale = useSharedValue(0.9);
  const pageOpacity = useSharedValue(0);
  const pageScale = useSharedValue(0.95);
  const thumbScale = useSharedValue(1);

  // Sync reanimated scrubber with global progress when not scrubbing
  useEffect(() => {
    if (!isScrubbing.value && scrubberWidth.value > 0) {
      scrubberX.value = globalProgress * scrubberWidth.value;
    }
  }, [globalProgress, scrubberWidth.value]);

  useEffect(() => {
    pageOpacity.value = withTiming(1, { duration: 400 });
    pageScale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  useEffect(() => {
    artScale.value = withSpring(isPlaying ? 1.05 : 0.94, SPRING_CONFIG);
  }, [isPlaying]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const scrubberGesture = Gesture.Pan()
    .onStart((event) => {
      isScrubbing.value = true;
      thumbScale.value = withSpring(1.4, SPRING_CONFIG);
      scrubberX.value = Math.max(0, Math.min(event.x, scrubberWidth.value));
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      scrubberX.value = Math.max(0, Math.min(event.x, scrubberWidth.value));
      runOnJS(Haptics.selectionAsync)();
    })
    .onEnd(() => {
      isScrubbing.value = false;
      thumbScale.value = withSpring(1, SPRING_CONFIG);
      const newProgress = scrubberX.value / scrubberWidth.value;
      runOnJS(seek)(newProgress);
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
    });

  const volumeGesture = Gesture.Pan()
    .onStart((event) => {
      const vol = Math.max(0, Math.min(event.x / volumeWidth.value, 1));
      volumeX.value = vol;
      runOnJS(setVolume)(vol);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((event) => {
      const vol = Math.max(0, Math.min(event.x / volumeWidth.value, 1));
      volumeX.value = vol;
      runOnJS(setVolume)(vol);
      runOnJS(Haptics.selectionAsync)();
    });

  // ── Animated Styles ────────────────────────────────────────────────────────
  const scrubberFillStyle = useAnimatedStyle(() => ({
    width: scrubberX.value,
  }));

  const scrubberThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: scrubberX.value - 10 },
      { scale: thumbScale.value }
    ],
  }));

  const volumeFillStyle = useAnimatedStyle(() => ({
    width: volumeX.value * volumeWidth.value,
  }));

  const volumeThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (volumeX.value * volumeWidth.value) - 7 }],
  }));

  const artStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artScale.value }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
    transform: [{ scale: pageScale.value }],
  }));

  const displayElapsed = useDerivedValue(() => {
    if (isScrubbing.value) {
      return Math.round((scrubberX.value / scrubberWidth.value) * durationSec);
    }
    return globalElapsed;
  });

  const elapsedText = useDerivedValue(() => formatTime(displayElapsed.value));
  const remainingText = useDerivedValue(() => `-${formatTime(Math.max(0, durationSec - displayElapsed.value))}`);

  if (!currentTrack) return null;

  const c0 = currentTrack.dominantColors[0] || '#BF5AF2';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View style={[styles.container, containerStyle]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* ── DYNAMIC BACKGROUND ──────────────────────────────────────── */}
        <View style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#08080d' }]} />
          <LinearGradient
            colors={[c0 + '66', c0 + '22', 'transparent']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(8,8,13,0.4)', 'rgba(8,8,13,0.8)', 'rgba(8,8,13,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={[styles.mainCanvas, { paddingTop: insets.top + 4 }]}>
          {/* Header */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
              <Ionicons name="chevron-down-outline" size={30} color={c0} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.nowPlayingLabel}>NOW PLAYING</Text>
            </View>
            <TouchableOpacity onPress={() => setIsInfoVisible(true)} style={styles.headerIcon}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={28} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          {/* Album Art */}
          <View style={styles.albumArtSection}>
             <Animated.View style={[styles.artOuterGlow, { shadowColor: c0 }]} />
             <Animated.View style={[styles.artGlassContainer, artStyle]}>
                <Image
                  source={{ uri: currentTrack.art }}
                  style={styles.albumImage}
                  contentFit="cover"
                  transition={300}
                />
                {(isBuffering || isLoading) && (
                  <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                    <ActivityIndicator size="large" color="#FFF" />
                  </View>
                )}
             </Animated.View>
          </View>

          {/* Song Info */}
          <View style={styles.songInfoSection}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
              <TouchableOpacity onPress={() => openArtistByName(router, currentTrack.artist)}>
                <Text style={styles.artistName} numberOfLines={1}>{currentTrack.artist}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setIsLiked(!isLiked); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.likeBtn}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={28} color={isLiked ? c0 : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
          </View>

          {/* Scrubber */}
          <View style={styles.scrubberSection}>
             <GestureDetector gesture={scrubberGesture}>
                <Animated.View style={styles.scrubberContainer}>
                  <GlassCard style={styles.scrubberCard} borderRadius={8} blurIntensity={20}>
                    <View 
                      style={styles.scrubberOuter}
                      onLayout={(e) => {
                        scrubberWidth.value = e.nativeEvent.layout.width;
                      }}
                    >
                      <Animated.View style={[styles.scrubberInner, scrubberFillStyle, { backgroundColor: c0 }]} />
                      <Animated.View style={[styles.scrubberThumb, scrubberThumbStyle]} />
                    </View>
                  </GlassCard>
                </Animated.View>
             </GestureDetector>
             <View style={styles.timeLabels}>
                <AnimatedTimeLabel text={elapsedText} />
                <AnimatedTimeLabel text={remainingText} />
             </View>
          </View>

          {/* Playback Controls */}
          <View style={styles.playbackControls}>
            <TouchableOpacity onPress={() => { prev(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.skipBtn}>
              <Ionicons name="play-skip-back" size={36} color="#FFF" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => { isPlaying ? pause() : play(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }}
              style={[styles.playButton, { backgroundColor: c0 }]}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={44} color="#FFF" style={{ marginLeft: isPlaying ? 0 : 5 }} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { next(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.skipBtn}>
              <Ionicons name="play-skip-forward" size={36} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Extra Controls */}
          <View style={styles.secondaryControls}>
            <TouchableOpacity onPress={toggleShuffle}>
              <Ionicons name="shuffle" size={24} color={isShuffle ? c0 : 'rgba(255,255,255,0.4)'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/lyrics')}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleRepeat}>
              <Ionicons 
                name={repeatMode === 1 ? "repeat-outline" : "repeat"} 
                size={24} 
                color={repeatMode !== 0 ? c0 : 'rgba(255,255,255,0.4)'} 
              />
            </TouchableOpacity>
          </View>

          {/* Volume */}
          <View style={styles.volumeSection}>
            <Ionicons name="volume-low" size={18} color="rgba(255,255,255,0.2)" />
            <GestureDetector gesture={volumeGesture}>
              <Animated.View style={styles.volumeTrackContainer}>
                <GlassCard style={styles.volumeCard} borderRadius={4} blurIntensity={20}>
                  <View 
                    style={styles.volumeTrack}
                    onLayout={(e) => {
                      volumeWidth.value = e.nativeEvent.layout.width;
                    }}
                  >
                    <Animated.View style={[styles.volumeFill, volumeFillStyle, { backgroundColor: c0 }]} />
                    <Animated.View style={[styles.volumeThumb, volumeThumbStyle]} />
                  </View>
                </GlassCard>
              </Animated.View>
            </GestureDetector>
            <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.2)" />
          </View>
        </View>

        {/* Info Modal */}
        <Modal visible={isInfoVisible} transparent animationType="fade" onRequestClose={() => setIsInfoVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsInfoVisible(false)}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <GlassCard style={styles.infoModal} borderRadius={32}>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Track Details</Text>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Format</Text><Text style={styles.infoValue}>FLAC 24-bit / 48kHz</Text></View>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Source</Text><Text style={styles.infoValue}>Aura Premium Master</Text></View>
                <TouchableOpacity onPress={() => setIsInfoVisible(false)} style={[styles.closeBtn, { backgroundColor: c0 }]}>
                  <Text style={styles.closeBtnText}>DONE</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </Modal>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

const AnimatedTimeLabel = ({ text }: { text: any }) => {
  const [label, setLabel] = useState('00:00');
  
  useDerivedValue(() => {
    runOnJS(setLabel)(text.value);
  });

  return <Text style={styles.timeLabel}>{label}</Text>;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080d' },
  mainCanvas: { flex: 1, paddingHorizontal: 28, paddingBottom: 32 },
  dragHandleContainer: { alignItems: 'center', marginBottom: 16 },
  dragHandle: { width: 36, height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  nowPlayingLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  albumArtSection: { flex: 1.2, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  artOuterGlow: { position: 'absolute', width: width * 0.7, height: width * 0.7, borderRadius: 32, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 40 },
  artGlassContainer: { width: width * 0.78, aspectRatio: 1, borderRadius: 32, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', elevation: 20 },
  albumImage: { flex: 1 },
  loadingOverlay: { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  songInfoSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 },
  trackTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  artistName: { fontSize: 17, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: '500' },
  likeBtn: { padding: 6 },
  scrubberSection: { marginBottom: 28 },
  scrubberContainer: { paddingVertical: 10 },
  scrubberCard: { height: 6 },
  scrubberOuter: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', position: 'relative' },
  scrubberInner: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  scrubberThumb: { position: 'absolute', top: -7, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  timeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  playbackControls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 36 },
  skipBtn: { padding: 10 },
  playButton: { width: 84, height: 84, borderRadius: 42, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  secondaryControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, marginBottom: 28 },
  volumeSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  volumeTrackContainer: { flex: 1, paddingVertical: 10 },
  volumeCard: { height: 4 },
  volumeTrack: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', position: 'relative' },
  volumeFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  volumeThumb: { position: 'absolute', top: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFF' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  infoModal: { width: '100%', padding: 24 },
  infoContent: { gap: 20 },
  infoTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  infoValue: { color: '#FFF', fontWeight: '700' },
  closeBtn: { height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#000', fontWeight: '900', letterSpacing: 1 },
});

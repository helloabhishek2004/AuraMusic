import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMusic } from '../context/MusicContext';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SW } = Dimensions.get('window');

const SP = { tension: 60, friction: 9 };
const POP = { tension: 200, friction: 8 };

export default function MiniPlayer() {
  const { currentTrack, isPlaying, progress, play, pause, next } = useMusic();
  const router = useRouter();
  
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  if (!currentTrack) return null;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, ...POP, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, ...POP, useNativeDriver: true }).start();
  };

  const handleOpenNowPlaying = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/now_playing',
      params: { trackId: currentTrack.id },
    });
  };

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleNext = (e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    next();
  };

  return (
    <Animated.View 
      style={[
        s.container,
        { transform: [{ scale }], opacity }
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleOpenNowPlaying}
        style={StyleSheet.absoluteFill}
      >
        {/* ── 4-LAYER GLASS CONTAINER ── */}
        <View style={s.glassEffect}>
          <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
          
          {/* Specular Highlights & Border */}
          <View pointerEvents="none" style={s.specTop} />
          <View pointerEvents="none" style={s.specLeft} />
          <View pointerEvents="none" style={s.refraction} />
          
          <View style={s.content}>
            {/* Thumb */}
            <View style={s.artWrap}>
              <Image 
                source={{ uri: currentTrack.art }}
                style={s.art}
                contentFit="cover"
                transition={200}
              />
            </View>

            {/* Titles */}
            <View style={s.meta}>
              <Text style={s.title} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>

            {/* Progress Bar */}
            <View style={s.progressRow}>
              <View style={s.pbBase}>
                <Animated.View style={[s.pbFill, { width: `${progress * 100}%` }]} />
                <View style={[s.pbGlow, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            {/* Controls */}
            <View style={s.controls}>
              <TouchableOpacity 
                style={s.controlBtn} 
                onPress={handlePlayPause}
                activeOpacity={0.7}
              >
                <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="#000" style={!isPlaying ? { marginLeft: 2 } : {}} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={s.nextBtn} 
                onPress={handleNext}
                activeOpacity={0.7}
              >
                <Ionicons name="play-skip-forward" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110, 
    left: 20,
    right: 20,
    height: 64,
    zIndex: 999,
  },
  glassEffect: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 22, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  specTop: {
    position: 'absolute',
    top: 0,
    left: 30,
    right: 30,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.22)',
    zIndex: 5,
  },
  specLeft: {
    position: 'absolute',
    left: 8,
    top: 10,
    bottom: 10,
    width: 2.5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ skewX: '-8deg' }],
    zIndex: 5,
  },
  refraction: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  artWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  art: { width: '100%', height: '100%' },
  meta: {
    marginLeft: 12,
    flex: 1.2,
  },
  title: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  artist: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 },
  
  progressRow: {
    flex: 1,
    marginHorizontal: 12,
  },
  pbBase: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  pbFill: {
    height: '100%',
    backgroundColor: '#BF5AF2',
    zIndex: 2,
  },
  pbGlow: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#BF5AF2',
    opacity: 0.5,
  },
  
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 4,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BF5AF2',
    shadowRadius: 10,
    shadowOpacity: 0.4,
  },
  nextBtn: {
    padding: 6,
  },
});

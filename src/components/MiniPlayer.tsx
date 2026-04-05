import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SW } = Dimensions.get('window');

/**
 * Global Mini Player Component 
 * Inspired by the design in page.txt
 */
export default function MiniPlayer() {
  const progress = 0.42;

  return (
    <View style={s.container}>
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
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7QyWLCr0uXkrtCWoGoXTfHFzGXwGP0GfezAi3bE1Zoy0n-ZxGCu75tlVWLIreBKwK5XYqs_bwhB9bZFS-RwHRzHg-cMww0yFFfnkcqDILEMzFzw3UzMLb7wQ9fqgC831em3RUpLtE4tqyhWEK7tn02kW1lhye7OMIwbQq2vDp-KmoMZR5SwzyyOOC7_RIGQBU2kZoZzZvgJB_GnEYPXGuzd_uECbnuBe-WvSzMuoei4vaBoL41TggGTxAg8xZZ0DOf9H-cVvvZ0k' }}
              style={s.art}
              contentFit="cover"
            />
          </View>

          {/* Titles (hidden on small screens if space is tight) */}
          <View style={s.meta}>
            <Text style={s.title} numberOfLines={1}>Neon Dreams</Text>
            <Text style={s.artist} numberOfLines={1}>The Midnight Syndicate</Text>
          </View>

          {/* Progress Bar (Global bar style) */}
          <View style={s.progressRow}>
            <View style={s.pbBase}>
              <View style={[s.pbFill, { width: `${progress * 100}%` }]} />
              <View style={[s.pbGlow, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity style={s.controlBtn}>
              <Ionicons name="play" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn}>
              <Ionicons name="play-skip-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110, // above the floating nav
    left: 20,
    right: 20,
    height: 60,
    zIndex: 999,
  },
  glassEffect: {
    flex: 1,
    borderRadius: 30,
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
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  artWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  art: { width: '100%', height: '100%' },
  meta: {
    marginLeft: 12,
    flex: 1.5,
  },
  title: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  artist: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },
  
  progressRow: {
    flex: 1,
    marginHorizontal: 16,
  },
  pbBase: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 1.5,
    overflow: 'hidden',
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
    opacity: 0.4,
    shadowColor: '#BF5AF2',
    shadowRadius: 6,
    shadowOpacity: 1,
  },
  
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFF',
    shadowRadius: 8,
    shadowOpacity: 0.3,
  },
  nextBtn: {
    padding: 4,
  },
});

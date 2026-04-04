import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Platform,
  Share,
  StatusBar,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Screen Dimensions
const { width, height } = Dimensions.get('window');

// Track data (Centralized or copied for now)
const tracks = [
  {
    id: '1',
    title: 'Midnight City',
    artist: 'M83',
    durationSec: 243,
    art: 'https://picsum.photos/seed/m83/800',
    dominantColors: ['#46f5e0', '#003731'],
    lyrics: [
      "Lost in the echo of a neon dream",
      "Dancing through the Purple Nebula",
      "Where the silence speaks in melodies",
      "And the stars are breathing frequency",
      "I can feel the rhythm taking hold",
      "In a world where time is made of gold",
      "Let the pulsar guide us through the night",
      "Into the canvas of eternal light",
      "Fading out into the cosmic sea",
      "Where the only one I see is me",
    ]
  },
  {
    id: '2',
    title: 'Starboy',
    artist: 'The Weeknd',
    durationSec: 230,
    art: 'https://picsum.photos/seed/starboy/800',
    dominantColors: ['#ff4d4d', '#330000'],
    lyrics: [
      "Neon lights flashing in the night",
      "Everything is gonna be alright",
      "Ride the wave of binary code",
      "In the digital street, take the road",
      "Synthesizer pulse in my chest",
      "Putting our hearts to the test",
      "Glowing circuits, electric heart",
      "Never gonna fall apart",
    ]
  },
  {
    id: '3',
    title: 'Nightcall',
    artist: 'Kavinsky',
    durationSec: 258,
    art: 'https://picsum.photos/seed/kavinsky/800',
    dominantColors: ['#BF5AF2', '#1a0033'],
    lyrics: [
      "I'm giving you a nightcall to tell you how I feel",
      "I want to drive you through the night, down the hills",
      "I'm gonna tell you something you don't want to hear",
      "I'm gonna show you where it's dark, but have no fear",
      "There's something inside you, it's hard to explain",
      "They're talking about you, boy, but you're still the same",
    ]
  },
  {
    id: '4',
    title: 'After Hours',
    artist: 'The Weeknd',
    durationSec: 362,
    art: 'https://picsum.photos/seed/afterhours/800',
    dominantColors: ['#ffb4ab', '#93000a'],
    lyrics: [
      "Thought I almost died in my dream again",
      "Fighting for my life, I couldn't breathe again",
      "I'm falling into a deep state",
      "My heart is cold, it's getting late",
    ]
  },
  {
    id: '5',
    title: 'Resonance',
    artist: 'HOME',
    durationSec: 212,
    art: 'https://picsum.photos/seed/resonance/800',
    dominantColors: ['#46f5e0', '#003731'],
    lyrics: [
      "(Instrumental Harmony)",
      "Vibrations in the aether",
      "Frequencies of time",
      "Resonating through the soul",
    ]
  },
];

export default function LyricsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const trackId = params.trackId as string || '1';
  const track = tracks.find(t => t.id === trackId) || tracks[0];
  const lyrics = track.lyrics;

  const [activeIndex, setActiveIndex] = useState(0); 
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  // Simulation: Move active lyric every 5 seconds for demonstration
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % lyrics.length);
    }, 5000);
    
    // Glowing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    ).start();

    return () => clearInterval(interval);
  }, [lyrics.length]);

  // Scroll to active index
  useEffect(() => {
    flatListRef.current?.scrollToIndex({
      index: activeIndex,
      animated: true,
      viewPosition: 0.5, // Center it
    });
  }, [activeIndex]);

  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 30],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out these lyrics from ${track.title}!`,
      });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  const renderLyricItem = ({ item, index }: { item: string, index: number }) => {
    const isActive = index === activeIndex;
    
    return (
      <View style={styles.lyricItemContainer}>
        <Animated.Text style={[
          styles.lyricText,
          isActive ? styles.lyricTextActive : styles.lyricTextInactive,
          isActive && { 
            textShadowColor: track.dominantColors[0],
            textShadowRadius: glowRadius,
            opacity: glowOpacity,
          }
        ]}>
          {item}
        </Animated.Text>
        {isActive && (
          <View style={styles.activeIndicatorContainer}>
             <Animated.View style={[
               styles.activeUnderlineWrapper,
               { opacity: glowOpacity, transform: [{ scaleX: glowAnim }] }
             ]}>
               <LinearGradient
                 colors={[track.dominantColors[0], 'transparent']}
                 start={{ x: 0, y: 0.5 }}
                 end={{ x: 1, y: 0.5 }}
                 style={styles.activeUnderline}
               />
             </Animated.View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background with subtle gradient */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#131318' }]} />
        <LinearGradient
          colors={[`${track.dominantColors[0]}15`, '#131318']}
          style={StyleSheet.absoluteFill}
        />
        {/* Subtle glow spots */}
        <View style={[styles.glowSpot, { top: '20%', left: '-10%', backgroundColor: track.dominantColors[0] }]} />
      </View>

      <View style={[styles.main, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.headerIcon}>
            <Ionicons name="chevron-down-outline" size={30} color="white" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Lyrics</Text>
            <View style={styles.toggleContainer}>
              <TouchableOpacity style={[styles.toggleBtn, styles.toggleBtnActive]}>
                <Text style={styles.toggleTextActive}>EN</Text>
              </TouchableOpacity>
              <View style={styles.toggleDivider} />
              <TouchableOpacity style={styles.toggleBtn}>
                <Text style={styles.toggleText}>ORIGINAL</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={onShare} activeOpacity={0.7} style={styles.headerIcon}>
            <Ionicons name="share-outline" size={26} color="white" />
          </TouchableOpacity>
        </View>

        {/* Lyrics List */}
        <FlatList
          ref={flatListRef}
          data={lyrics}
          keyExtractor={(_, index) => index.toString()}
          renderItem={renderLyricItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={120} // Match item height for snappy scrolling
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: 120,
            offset: 120 * index,
            index,
          })}
        />

        {/* Mini Player at bottom */}
        <View style={[styles.miniPlayerContainer, { marginBottom: insets.bottom + 16 }]}>
           <BlurView intensity={30} tint="dark" style={styles.miniPlayerGlass}>
              {/* Progress Line */}
              <View style={styles.miniProgressContainer}>
                 <View style={[styles.miniProgressFill, { width: '40%', backgroundColor: track.dominantColors[0] }]} />
              </View>

              <View style={styles.miniPlayerContent}>
                <Image source={{ uri: track.art }} style={styles.miniArt} />
                <View style={styles.miniInfo}>
                  <Text style={styles.miniTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={styles.miniArtist} numberOfLines={1}>{track.artist}</Text>
                </View>

                <View style={styles.miniControls}>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Ionicons name="play-skip-back" size={24} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.miniPlayBtn, { backgroundColor: '#c792ff' }]} activeOpacity={0.9}>
                    <Ionicons name="pause" size={24} color="black" />
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Ionicons name="play-skip-forward" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
           </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131318',
  },
  main: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 80,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    marginTop: 8,
    padding: 4,
    alignItems: 'center',
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 15,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  toggleText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  toggleDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 2,
  },
  listContent: {
    paddingTop: height * 0.2, // Start with space
    paddingBottom: height * 0.4, // End with space
    paddingHorizontal: 30,
  },
  lyricItemContainer: {
    height: 120,
    justifyContent: 'center',
  },
  lyricText: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 38,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Manrope',
  },
  lyricTextActive: {
    color: 'white',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  lyricTextInactive: {
    color: 'rgba(170, 170, 185, 0.35)',
  },
  activeIndicatorContainer: {
    height: 4,
    marginTop: 12,
  },
  activeUnderlineWrapper: {
    width: 120,
    height: 4,
  },
  activeUnderline: {
    width: 120,
    height: 4,
    borderRadius: 2,
  },
  glowSpot: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.15,
  },
  miniPlayerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  miniPlayerGlass: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  miniProgressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  miniProgressFill: {
    height: '100%',
  },
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  miniInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  miniArtist: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  miniPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

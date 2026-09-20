/**
 * FAQScreen — Real, Interactive Frequently Asked Questions
 *
 * Implements smooth Reanimated accordion UI answering genuine AuraMusic features:
 *  - General, Playback (Media3), Downloads & Offline, Lyrics (LRCLIB),
 *    Playlists & Library, Discover, Android Backup, Audio Quality.
 *  - Glass card styling, light haptic feedback on expand/collapse,
 *    smooth layout animations, and accessible touch targets.
 */

import React, { memo, useState, useCallback } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

const BG = '#0F0F13';
const PRIMARY = '#BF5AF2';
const TEXT_MUTED = 'rgba(255, 255, 255, 0.70)';
const TEXT_FAINT = 'rgba(255, 255, 255, 0.45)';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    title: 'General',
    icon: 'info-outline',
    items: [
      {
        id: 'gen-1',
        question: 'What is AuraMusic?',
        answer:
          'AuraMusic is a modern, privacy-respecting audio streaming and offline playback client for Android. It combines Apple HIG-inspired Liquid Glass aesthetics with an Android-native Media3 audio engine.',
      },
      {
        id: 'gen-2',
        question: 'Does AuraMusic require an account or sign-up?',
        answer:
          'No. AuraMusic is 100% account-free. You do not need to register, provide an email address, or log in to stream music, download tracks, or create playlists.',
      },
      {
        id: 'gen-3',
        question: 'Where does music data come from?',
        answer:
          'Music catalog metadata, search results, and high-fidelity audio streams are retrieved directly from public YouTube Music and Google CDN endpoints on-device without any intermediary server.',
      },
    ],
  },
  {
    title: 'Playback Engine',
    icon: 'play-circle-outline',
    items: [
      {
        id: 'play-1',
        question: 'How does playback work under the hood?',
        answer:
          'AuraMusic is powered by Android\'s official Media3 / ExoPlayer pipeline integrated with custom Kotlin background services. This delivers hardware-accelerated audio decoding, gapless track transitions, and native audio focus management.',
      },
      {
        id: 'play-2',
        question: 'Why does a song sometimes take a moment to start?',
        answer:
          'When you tap a track, AuraMusic resolves the optimal streaming audio format and buffers the initial audio chunk over your connection. On high-speed networks this is near-instant, but cellular latency can cause a brief initial buffer.',
      },
      {
        id: 'play-3',
        question: 'Does playback continue in the background and on lockscreen?',
        answer:
          'Yes. AuraMusic operates as a foreground audio service with a persistent Android MediaSession. You have full lockscreen controls, notification player controls, and Bluetooth headphone button support.',
      },
    ],
  },
  {
    title: 'Downloads & Offline',
    icon: 'cloud-download',
    items: [
      {
        id: 'dl-1',
        question: 'How do downloads work?',
        answer:
          'When you download a song, our background DownloadManager downloads the audio stream, fetches high-resolution album artwork, embeds ID3 metadata, and indexes the song in your local Room SQLite database.',
      },
      {
        id: 'dl-2',
        question: 'Where are downloaded songs stored?',
        answer:
          'Downloaded files are saved in the app\'s secure, private sandbox directory (/files/aura/audio/). Under Android security policies, other non-root applications cannot access or tamper with these files.',
      },
      {
        id: 'dl-3',
        question: 'Can downloaded music play completely offline?',
        answer:
          'Yes! All downloaded songs and your local audio library can be played without Wi-Fi or cellular data. AuraMusic automatically switches to local file playback when offline.',
      },
      {
        id: 'dl-4',
        question: 'Why might download metadata take a moment to appear?',
        answer:
          'During download, the app performs a fast metadata enrichment step to verify album titles, artists, and artwork thumbnails. Once finished, full details appear immediately in your Downloads list.',
      },
    ],
  },
  {
    title: 'Lyrics',
    icon: 'subtitles',
    items: [
      {
        id: 'lyr-1',
        question: 'How are lyrics retrieved?',
        answer:
          'AuraMusic synchronizes real-time lyrics from the community-powered LRCLIB database using the song\'s canonical title, artist, and track duration.',
      },
      {
        id: 'lyr-2',
        question: 'Why might lyrics be unavailable for some songs?',
        answer:
          'Lyrics are crowd-sourced on LRCLIB. Unreleased singles, recent indie releases, instrumental tracks, or unique remixes may not yet have synchronized timestamps uploaded.',
      },
      {
        id: 'lyr-3',
        question: 'What happens when changing songs rapidly?',
        answer:
          'The lyrics engine uses automatic abort controllers to cancel obsolete network requests whenever a new song starts, ensuring you always see the lyrics for the currently playing track.',
      },
    ],
  },
  {
    title: 'Playlists & Library',
    icon: 'library-music',
    items: [
      {
        id: 'lib-1',
        question: 'How do I create and manage playlists?',
        answer:
          'Navigate to the Library tab and tap "New Playlist". You can add songs to any playlist from search results, album views, the queue, or the Now Playing screen options menu.',
      },
      {
        id: 'lib-2',
        question: 'Can an entire playlist be downloaded?',
        answer:
          'Yes. Open any playlist and tap the "Download Playlist" action button. All tracks in the playlist will be queued and downloaded in the background.',
      },
      {
        id: 'lib-3',
        question: 'How does the Liked Songs playlist work?',
        answer:
          'Tapping the heart icon on any track automatically adds it to your "Liked Songs" collection, instantly persisted into your local Room database for quick access.',
      },
    ],
  },
  {
    title: 'Discover & Recommendations',
    icon: 'explore',
    items: [
      {
        id: 'disc-1',
        question: 'How does Discover Music refresh?',
        answer:
          'Discover calculates recommendations using on-device listening affinity (play counts, completions, and skip rates) combined with rotating global trending mixes.',
      },
      {
        id: 'disc-2',
        question: 'Can I manually refresh recommendations?',
        answer:
          'Yes, pull-to-refresh is fully supported on the Discover screen to generate a fresh set of mixes and artist recommendations.',
      },
    ],
  },
  {
    title: 'Android Backup',
    icon: 'cloud-sync',
    items: [
      {
        id: 'back-1',
        question: 'How does Android Backup work in AuraMusic?',
        answer:
          'AuraMusic implements Android Auto Backup rules. Your SQLite database (aura_music.db) and preferences are securely backed up to your personal Google Drive AppData storage.',
      },
      {
        id: 'back-2',
        question: 'What data is included in the backup?',
        answer:
          'Your playlists, liked songs, listening history, and playback settings are preserved. Audio files and caches are excluded to keep backup size well under 1 MB.',
      },
    ],
  },
  {
    title: 'Audio Quality',
    icon: 'high-quality',
    items: [
      {
        id: 'aud-1',
        question: 'What audio qualities are supported?',
        answer:
          'You can customize audio quality in Settings for both Wi-Fi and Cellular networks: Normal (96 kbps Opus), High (160 kbps Opus/AAC), and Very High / Best (up to 320 kbps high-bitrate stream).',
      },
    ],
  },
];

// ── Accordion Item Component ──
const AccordionRow = memo(({ item }: { item: FAQItem }) => {
  const [isOpen, setIsOpen] = useState(false);
  const progress = useSharedValue(0);

  const toggleOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextState = !isOpen;
    setIsOpen(nextState);
    progress.value = withTiming(nextState ? 1 : 0, { duration: 250 });
  }, [isOpen, progress]);

  const chevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 90]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  return (
    <View style={styles.accordionItem}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleOpen}
        style={styles.questionButton}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        accessibilityLabel={item.question}
      >
        <Text style={[styles.questionText, isOpen && styles.questionTextOpen]}>
          {item.question}
        </Text>
        <Animated.View style={chevronStyle}>
          <MaterialIcons
            name="chevron-right"
            size={22}
            color={isOpen ? PRIMARY : 'rgba(255, 255, 255, 0.40)'}
          />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.answerContainer}>
          <Text style={styles.answerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
});

// ── Category Card ──
const CategoryCard = memo(({ category }: { category: FAQCategory }) => (
  <View style={styles.categoryCardWrapper}>
    <View style={styles.categoryCard}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(32, 28, 42, 0.88)' }]}
        />
      )}
      {/* Specular sheen */}
      <View style={styles.specular} pointerEvents="none" />
      {/* Border outline */}
      <View style={styles.cardBorder} pointerEvents="none" />

      <View style={styles.categoryHeader}>
        <View style={styles.categoryIconBadge}>
          <MaterialIcons name={category.icon} size={18} color={PRIMARY} />
        </View>
        <Text style={styles.categoryTitle}>{category.title}</Text>
      </View>

      <View style={styles.questionsList}>
        {category.items.map((item, idx) => (
          <React.Fragment key={item.id}>
            {idx > 0 && <View style={styles.divider} />}
            <AccordionRow item={item} />
          </React.Fragment>
        ))}
      </View>
    </View>
  </View>
));

export default function FAQScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Atmospheric Background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />
        <LinearGradient
          colors={['rgba(108, 55, 169, 0.14)', 'transparent', 'rgba(70, 34, 192, 0.10)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar with Back Button ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Help & FAQ</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Header Intro ── */}
        <View style={styles.headerBlock}>
          <Text style={styles.mainTitle}>Frequently Asked Questions</Text>
          <Text style={styles.subtitle}>
            Everything you need to know about AuraMusic playback, downloads, lyrics, and privacy.
          </Text>
        </View>

        {/* ── Grouped Categories ── */}
        {FAQ_DATA.map((cat) => (
          <CategoryCard key={cat.title} category={cat} />
        ))}

        {/* Footer Brand */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerBrandText}>Aura Music Help Center</Text>
          <Text style={styles.footerSubText}>Need more help? Check the GitHub repository</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  headerBlock: {
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: TEXT_MUTED,
    marginTop: 6,
  },

  // ── Category Card ──
  categoryCardWrapper: {
    marginBottom: 16,
  },
  categoryCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 2,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  categoryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(191, 90, 242, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  questionsList: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  divider: {
    height: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  // ── Accordion Item ──
  accordionItem: {
    paddingVertical: 10,
  },
  questionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    lineHeight: 19,
  },
  questionTextOpen: {
    color: PRIMARY,
  },
  answerContainer: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingRight: 12,
  },
  answerText: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
  },

  // ── Footer ──
  footerBrand: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerSubText: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
});

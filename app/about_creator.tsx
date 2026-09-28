/**
 * AboutCreatorScreen — Meet the Person Behind AuraMusic
 *
 * iOS-inspired Liquid Glass & Sonic Nebula design language:
 *  - Refined atmospheric ambient background with subtle violet/cyan orbs
 *  - Symmetrically bordered avatar container with AVATAR.png
 *  - Display name: @bh!shek
 *  - iOS-style frosted glass cards with high contrast & specular sheen
 *  - Links: Website (about-abhishek.vercel.app), GitHub (helloabishek2004), LinkedIn (abhisheks20)
 *  - Authentic "Buy me a coffee" button modeled precisely from the design reference
 */

import React, { memo, useCallback, useEffect } from 'react';
import {
  Alert,
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
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';

const { width: SW } = Dimensions.get('window');

// ── Palette & Design Tokens (Sonic Nebula / Liquid Glass) ────────────────────
const BG = '#0B0B0F';
const PRIMARY = '#DAB9FF'; // Signature lavender-violet
const SECONDARY = '#46F5E0'; // Sonic aqua shimmer
const SURFACE_BACKING = 'rgba(22, 19, 32, 0.84)';
const BORDER_COLOR = 'rgba(255, 255, 255, 0.12)';
const SPECULAR_COLOR = 'rgba(255, 255, 255, 0.22)';

// ── Creator Configuration ───────────────────────────────────────────────────
export const CREATOR_PROFILE = {
  name: '@bh!shek',
  role: 'Creator & Developer',
  subtitle: 'AuraMusic Architecture & Design',
  intro:
    'AuraMusic is an independent music player crafted by @bh!shek — combining a love for music, deep software engineering, and thoughtful Liquid Glass design.',
  websiteUrl: 'https://about-abhishek.vercel.app',
  githubUrl: 'https://github.com/helloabishek2004',
  linkedInUrl: 'https://linkedin.com/in/abhisheks20',
  buyMeACoffeeUrl: 'https://buymeacoffee.com/helloabhisy',
};

// ── Ambient Background (Deep Sonic Nebula, no generic neon) ──────────────────
const AmbientBackground = memo(() => {
  const x1 = useSharedValue(0);
  const y1 = useSharedValue(0);
  const x2 = useSharedValue(0);
  const y2 = useSharedValue(0);

  useEffect(() => {
    const ease = ReanimatedEasing.inOut(ReanimatedEasing.ease);
    x1.value = withRepeat(withTiming(SW * 0.10, { duration: 26000, easing: ease }), -1, true);
    y1.value = withRepeat(withTiming(SW * 0.08, { duration: 30000, easing: ease }), -1, true);
    x2.value = withRepeat(withTiming(-SW * 0.08, { duration: 32000, easing: ease }), -1, true);
    y2.value = withRepeat(withTiming(-SW * 0.06, { duration: 34000, easing: ease }), -1, true);
  }, [x1, y1, x2, y2]);

  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateX: x1.value }, { translateY: y1.value }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateX: x2.value }, { translateY: y2.value }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />
      {/* Subtle top violet ambient sphere */}
      <Animated.View
        style={[
          styles.blob,
          {
            backgroundColor: '#4c2678',
            top: -SW * 0.35,
            left: -SW * 0.15,
            width: SW * 1.25,
            height: SW * 1.25,
            borderRadius: SW * 0.625,
            opacity: 0.22,
          },
          s1,
        ]}
      />
      {/* Deep indigo aura */}
      <Animated.View
        style={[
          styles.blob,
          {
            backgroundColor: '#1b143b',
            top: SW * 0.40,
            right: -SW * 0.20,
            width: SW * 1.10,
            height: SW * 1.10,
            borderRadius: SW * 0.55,
            opacity: 0.20,
          },
          s2,
        ]}
      />
      {/* Bottom aqua shimmer */}
      <View
        style={[
          styles.blob,
          {
            backgroundColor: '#00473e',
            bottom: -SW * 0.25,
            left: SW * 0.05,
            width: SW * 0.90,
            height: SW * 0.90,
            borderRadius: SW * 0.45,
            opacity: 0.12,
          },
        ]}
      />
      <BlurView intensity={Platform.OS === 'ios' ? 70 : 40} tint="dark" style={StyleSheet.absoluteFill} />
    </View>
  );
});
AmbientBackground.displayName = 'AmbientBackground';

// ── iOS-Style Glass Card Container ───────────────────────────────────────────
const GlassCard = memo(
  ({
    children,
    style,
    r = 28,
  }: {
    children: React.ReactNode;
    style?: any;
    r?: number;
  }) => (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: SURFACE_BACKING }]} />
      {/* Specular catch highlight on top edge */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: r * 0.4,
          right: r * 0.4,
          height: 1.5,
          backgroundColor: SPECULAR_COLOR,
          zIndex: 4,
        }}
      />
      {/* Symmetric 1px glass border */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: r,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
        }}
      />
      {/* Subtle inner ambient sheen */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.01)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  )
);
GlassCard.displayName = 'GlassCard';

// ── Staggered Entrance Animation ─────────────────────────────────────────────
const StaggerSection = memo(
  ({
    children,
    delay = 100,
  }: {
    children: React.ReactNode;
    delay?: number;
  }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: 700, easing: ReanimatedEasing.bezier(0.2, 1, 0.3, 1) })
      );
      translateY.value = withDelay(
        delay,
        withTiming(0, { duration: 700, easing: ReanimatedEasing.bezier(0.2, 1, 0.3, 1) })
      );
    }, [delay, opacity, translateY]);

    const animStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={animStyle}>{children}</Animated.View>;
  }
);
StaggerSection.displayName = 'StaggerSection';

// ── iOS-Style Action Link Button ─────────────────────────────────────────────
interface ActionLinkProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accentColor?: string;
}

const ActionLinkButton = memo(({ icon, label, onPress, accentColor = '#FFF' }: ActionLinkProps) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 14, stiffness: 220 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle]}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.82}
        style={styles.actionLinkButton}
      >
        <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} />
        <View style={styles.actionLinkBorder} pointerEvents="none" />
        <View style={styles.actionLinkInner}>
          <Ionicons name={icon} size={18} color={accentColor} style={{ marginRight: 6 }} />
          <Text style={styles.actionLinkLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
ActionLinkButton.displayName = 'ActionLinkButton';

// ── Buy Me A Coffee Button (Matches User Reference Image Precisely) ───────────
const BuyMeACoffeeButton = memo(({ onPress }: { onPress: () => void }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 220 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ width: '100%' }, animStyle]}>
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.88}
        style={styles.bmacButton}
      >
        {/* Main purple pill background matching reference image */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#b45dfa' }]} />

        {/* Subtle top specular shimmer */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            right: 20,
            height: 1.5,
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
            zIndex: 3,
          }}
        />

        {/* Left main compartment: Sunglasses Emoji + "Buy me a coffee" text */}
        <View style={styles.bmacLeft}>
          <Text style={styles.bmacEmoji}>😎</Text>
          <Text style={styles.bmacText}>Buy me a coffee</Text>
        </View>

        {/* Right compartment: Heart icon + 0 counter */}
        <View style={styles.bmacRight}>
          <Ionicons name="heart" size={17} color="#FFFFFF" />
          <Text style={styles.bmacCounter}>0</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});
BuyMeACoffeeButton.displayName = 'BuyMeACoffeeButton';

// ── Main About Creator Screen ────────────────────────────────────────────────
export default function AboutCreatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Safe external URL opener
  const handleOpenUrl = useCallback(async (url: string, fallbackMessage: string) => {
    if (!url) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Link Update', fallbackMessage, [{ text: 'OK' }]);
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Could Not Open Link', `Unable to navigate to ${url}.`);
    }
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Atmospheric liquid background */}
      <AmbientBackground />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 48,
          },
        ]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {/* ── Top Bar ──────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            activeOpacity={0.7}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>About the Creator</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Creator Profile Hero ─────────────────────────────────────────── */}
        <StaggerSection delay={100}>
          <View style={styles.heroBlock}>
            {/* Concentric, equally distributed avatar container */}
            <View style={styles.avatarOuterGlow} pointerEvents="none" />
            <View style={styles.avatarRing}>
              <Image
                source={require('../assets/images/AVATAR.png')}
                style={styles.avatarImage}
                contentFit="cover"
                transition={300}
              />
              <View style={styles.avatarGlassBorder} pointerEvents="none" />
            </View>

            {/* Creator Name */}
            <Text style={styles.creatorName}>{CREATOR_PROFILE.name}</Text>

            {/* Role Badge */}
            <View style={styles.roleBadge}>
              <View style={styles.roleBadgeDot} />
              <Text style={styles.roleText}>{CREATOR_PROFILE.role}</Text>
            </View>

            {/* Concise Introduction */}
            <GlassCard r={24} style={styles.introCard}>
              <Text style={styles.introText}>{CREATOR_PROFILE.intro}</Text>
            </GlassCard>
          </View>
        </StaggerSection>

        {/* ── External / Social Links ──────────────────────────────────────── */}
        <StaggerSection delay={200}>
          <View style={styles.linksContainer}>
            <View style={styles.linksRow}>
              {/* Website */}
              <ActionLinkButton
                icon="globe-outline"
                label="Website"
                accentColor={SECONDARY}
                onPress={() =>
                  handleOpenUrl(
                    CREATOR_PROFILE.websiteUrl,
                    'Redirecting to portfolio...'
                  )
                }
              />

              {/* GitHub */}
              <ActionLinkButton
                icon="logo-github"
                label="GitHub"
                accentColor="#FFF"
                onPress={() =>
                  handleOpenUrl(
                    CREATOR_PROFILE.githubUrl,
                    'Redirecting to GitHub profile...'
                  )
                }
              />

              {/* LinkedIn */}
              <ActionLinkButton
                icon="logo-linkedin"
                label="LinkedIn"
                accentColor="#60A5FA"
                onPress={() =>
                  handleOpenUrl(
                    CREATOR_PROFILE.linkedInUrl,
                    'Redirecting to LinkedIn profile...'
                  )
                }
              />
            </View>
          </View>
        </StaggerSection>

        {/* ── Editorial Philosophy / Story ─────────────────────────────────── */}
        <StaggerSection delay={300}>
          <View style={styles.philosophyContainer}>
            <GlassCard r={28} style={styles.philosophyCard}>
              <View style={styles.quoteHeader}>
                <MaterialIcons name="format-quote" size={26} color={PRIMARY} style={{ opacity: 0.85 }} />
                <Text style={styles.philosophyTitle}>Built with curiosity.</Text>
              </View>

              <Text style={styles.philosophyBody}>
                {'\u201C'}AuraMusic started as an experiment in building a player the way I wanted to experience music — fast, personal, beautiful, and completely free.{'\u201D'}
              </Text>

              <Text style={styles.philosophySub}>
                An ongoing craft project where high-performance software engineering, interface beauty, and local audio fidelity meet without compromises.
              </Text>

              {/* Editorial Taglines */}
              <View style={styles.taglinesRow}>
                <View style={styles.taglineItem}>
                  <View style={styles.taglineDot} />
                  <Text style={styles.taglineText}>Independent Craft</Text>
                </View>
                <View style={styles.taglineItem}>
                  <View style={styles.taglineDot} />
                  <Text style={styles.taglineText}>Liquid Glass</Text>
                </View>
                <View style={styles.taglineItem}>
                  <View style={styles.taglineDot} />
                  <Text style={styles.taglineText}>Sonic Fidelity</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        </StaggerSection>

        {/* ── Support CTA (Exact Reference Image Button) ────────────────────── */}
        <StaggerSection delay={400}>
          <View style={styles.supportContainer}>
            <BuyMeACoffeeButton
              onPress={() =>
                handleOpenUrl(
                  CREATOR_PROFILE.buyMeACoffeeUrl,
                  'Opening Buy Me a Coffee in browser...'
                )
              }
            />

            <Text style={styles.supportFootnote}>
              Crafted with care by {CREATOR_PROFILE.name} · AuraMusic V3
            </Text>
          </View>
        </StaggerSection>
      </ScrollView>
    </View>
  );
}

// ── Stylesheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  blob: {
    position: 'absolute',
  },
  scrollContent: {
    paddingHorizontal: 18,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.2,
  },

  // Hero Section & Symmetrically Distributed Avatar
  heroBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarOuterGlow: {
    position: 'absolute',
    top: -6,
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: 'rgba(180, 100, 248, 0.18)',
    filter: 'blur(20px)' as any,
  },
  avatarRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#a855f7',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(218, 185, 255, 0.40)',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 62,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  creatorName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(218, 185, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.25)',
    marginBottom: 16,
  },
  roleBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  introCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    width: '100%',
  },
  introText: {
    fontSize: 13,
    lineHeight: 21,
    color: 'rgba(255, 255, 255, 0.80)',
    textAlign: 'center',
    fontWeight: '400',
  },

  // Social / External Links (Symmetric iOS Segmented Buttons)
  linksContainer: {
    marginBottom: 20,
  },
  linksRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  actionLinkButton: {
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLinkBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  actionLinkInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionLinkLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.1,
  },

  // Philosophy Card
  philosophyContainer: {
    marginBottom: 24,
  },
  philosophyCard: {
    padding: 20,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  philosophyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  philosophyBody: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.84)',
    fontWeight: '500',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  philosophySub: {
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.52)',
    marginBottom: 16,
  },
  taglinesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 14,
  },
  taglineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taglineDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SECONDARY,
    opacity: 0.85,
  },
  taglineText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Buy Me A Coffee Button (Precision design from user image)
  supportContainer: {
    alignItems: 'center',
  },
  bmacButton: {
    width: '100%',
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  bmacLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    gap: 12,
  },
  bmacEmoji: {
    fontSize: 22,
  },
  bmacText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bmacRight: {
    width: 56,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  bmacCounter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  supportFootnote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.36)',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

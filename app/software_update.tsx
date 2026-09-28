import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';

import { useUpdateStore } from '@/src/features/update/store/update.store';
import { getInstalledAppVersion } from '@/src/features/update/utils/app-version';

const { width: SW } = Dimensions.get('window');

// ── Color Tokens (Strictly from Stitch HTML / AuraMusic Design System) ───────
const BG = '#0b0b0f';
const SURFACE = '#131318';
const PRIMARY = '#dab9ff';
const PRIMARY_CONTAINER = '#6c37a9';
const SECONDARY = '#46f5e0';
const ON_SURFACE_VARIANT = '#a29db0';
const STATUS_RED = '#ff5c6a';

// ── Sonic Nebula Ambient Lighting Background ─────────────────────────────────
const AmbientNebula = memo(() => {
  const x1 = useSharedValue(0), y1 = useSharedValue(0);
  const x2 = useSharedValue(0), y2 = useSharedValue(0);

  useEffect(() => {
    const ease = ReanimatedEasing.inOut(ReanimatedEasing.ease);
    x1.value = withRepeat(withTiming(SW * 0.10, { duration: 22000, easing: ease }), -1, true);
    y1.value = withRepeat(withTiming(SW * 0.08, { duration: 26000, easing: ease }), -1, true);
    x2.value = withRepeat(withTiming(-SW * 0.08, { duration: 28000, easing: ease }), -1, true);
    y2.value = withRepeat(withTiming(-SW * 0.06, { duration: 30000, easing: ease }), -1, true);
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
      {/* Top purple orb */}
      <Animated.View
        style={[
          styles.nebulaOrb,
          {
            backgroundColor: '#7a2ff8',
            top: -48,
            left: -48,
            width: 260,
            height: 260,
            borderRadius: 130,
            opacity: 0.25,
          },
          s1,
        ]}
      />
      {/* Mid right primary orb */}
      <Animated.View
        style={[
          styles.nebulaOrb,
          {
            backgroundColor: PRIMARY,
            top: '35%',
            right: -80,
            width: 280,
            height: 280,
            borderRadius: 140,
            opacity: 0.15,
          },
          s2,
        ]}
      />
      {/* Bottom cyan orb */}
      <View
        style={[
          styles.nebulaOrb,
          {
            backgroundColor: SECONDARY,
            bottom: -40,
            left: '25%',
            width: 240,
            height: 240,
            borderRadius: 120,
            opacity: 0.10,
          },
        ]}
      />
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11, 11, 15, 0.82)' }]} />
      )}
    </View>
  );
});
AmbientNebula.displayName = 'AmbientNebula';

// ── Reusable Liquid Glass Container ──────────────────────────────────────────
const LiquidGlass = memo(
  ({
    children,
    style,
    r = 24,
    borderAccent,
  }: {
    children: React.ReactNode;
    style?: any;
    r?: number;
    borderAccent?: string;
  }) => (
    <View style={[{ borderRadius: r, overflow: 'hidden' }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30, 28, 38, 0.78)' }]} />
      )}
      {/* Subtle top specular catch line */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: r * 0.35,
          right: r * 0.35,
          height: 1.2,
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          zIndex: 4,
        }}
      />
      {/* 1px subtle glass boundary */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: r,
          borderWidth: 1,
          borderColor: borderAccent || 'rgba(255, 255, 255, 0.09)',
        }}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  )
);
LiquidGlass.displayName = 'LiquidGlass';

// ── Liquid Pill Container ───────────────────────────────────────────────────
const LiquidPill = memo(
  ({
    children,
    style,
    onPress,
    disabled = false,
  }: {
    children: React.ReactNode;
    style?: any;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    const Component: any = onPress ? TouchableOpacity : View;
    return (
      <Component
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
        style={[
          {
            borderRadius: 999,
            backgroundColor: 'rgba(40, 37, 52, 0.65)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.09)',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        {children}
      </Component>
    );
  }
);
LiquidPill.displayName = 'LiquidPill';

// ── Primary Glow Button ─────────────────────────────────────────────────────
const PrimaryGlowButton = memo(
  ({
    label,
    icon,
    onPress,
    disabled = false,
    loading = false,
    style,
  }: {
    label: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    style?: any;
  }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      disabled={disabled || loading}
      activeOpacity={0.88}
      style={[
        {
          borderRadius: 28,
          overflow: 'hidden',
          shadowColor: PRIMARY,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 8,
        },
        disabled && { opacity: 0.6 },
        style,
      ]}
    >
      <LinearGradient
        colors={[PRIMARY, '#9e64ea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingVertical: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#1a0038" />
        ) : (
          <>
            {icon && <MaterialIcons name={icon} size={20} color="#1a0038" />}
            <Text
              style={{
                fontFamily: 'Manrope_700Bold',
                fontSize: 14,
                color: '#1a0038',
                letterSpacing: 0.3,
              }}
            >
              {label}
            </Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  )
);
PrimaryGlowButton.displayName = 'PrimaryGlowButton';

// ── Circular Scrubber Progress Ring (SVG) ───────────────────────────────────
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CircularProgressRing = memo(({ percentage }: { percentage: number }) => {
  const strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * Math.min(100, Math.max(0, percentage))) / 100;

  return (
    <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow pulse ring */}
      <View
        style={{
          position: 'absolute',
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: 'rgba(218, 185, 255, 0.15)',
        }}
      />
      <Svg width={160} height={160} viewBox="0 0 160 160" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="progGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={PRIMARY} />
            <Stop offset="100%" stopColor={SECONDARY} />
          </SvgGradient>
        </Defs>
        <Circle
          cx="80"
          cy="80"
          r={RADIUS}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="8"
        />
        <Circle
          cx="80"
          cy="80"
          r={RADIUS}
          fill="transparent"
          stroke="url(#progGrad)"
          strokeWidth="8"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={`${strokeDashoffset}`}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 32, color: '#FFF', letterSpacing: -0.5 }}>
          {percentage}%
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
          Downloading
        </Text>
      </View>
    </View>
  );
});
CircularProgressRing.displayName = 'CircularProgressRing';

// ── Main Software Update Screen ──────────────────────────────────────────────
export default function SoftwareUpdateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const installedVersion = useMemo(() => getInstalledAppVersion(), []);

  const {
    phase,
    releaseInfo,
    hasUpdate,
    isChecking,
    lastCheckedTimestamp,
    errorMessage,
    downloadProgress,
    checkForUpdates,
    startDownload,
    cancelDownload,
    installUpdate,
    setSimulatedPhase,
  } = useUpdateStore();

  // Local sub-view for Release Notes sheet
  const [showNotesSheet, setShowNotesSheet] = useState(false);

  // Auto-check on screen mount (forced = false, cached if recent)
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showNotesSheet) {
      setShowNotesSheet(false);
      return;
    }
    router.back();
  }, [router, showNotesSheet]);

  const handleManualCheck = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    checkForUpdates(true);
  }, [checkForUpdates]);

  // Display version metadata
  const targetVersion = releaseInfo?.version || '3.1.0';
  const packageSize = releaseInfo?.apkAsset?.formattedSize || '44.2 MB';
  const releaseDate = releaseInfo?.formattedDate || 'September 2026';
  const summaryText =
    releaseInfo?.summary ||
    'A major refinement featuring polished Liquid Glass surfaces, improved playback cache, and enhanced library speed.';

  // Format last checked time
  const lastCheckedText = useMemo(() => {
    if (!lastCheckedTimestamp) return 'Just now';
    const minDiff = Math.floor((Date.now() - lastCheckedTimestamp) / 60000);
    if (minDiff < 1) return 'Just now';
    if (minDiff < 60) return `${minDiff}m ago`;
    return 'Today';
  }, [lastCheckedTimestamp]);

  // ── RENDER VIEW 1: RELEASE NOTES SHEET ───────────────────────────────────
  if (showNotesSheet) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        {/* Top Header */}
        <View style={styles.topBar}>
          <LiquidPill style={styles.pillIconBtn} onPress={() => setShowNotesSheet(false)}>
            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
          </LiquidPill>
          <Text style={styles.topBarTitle}>What&apos;s New</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.editorialTitle}>AuraMusic {targetVersion}</Text>
            <View style={styles.latestBadge}>
              <Text style={styles.latestBadgeText}>LATEST</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontWeight: '500' }}>
            Published {releaseDate} • {packageSize}
          </Text>
        </View>

        {/* Release Highlights Glass Paper */}
        <LiquidGlass style={{ flex: 1, marginHorizontal: 24, marginBottom: 16 }} r={28}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, gap: 18 }}
            showsVerticalScrollIndicator={false}
          >
            {releaseInfo?.sections && releaseInfo.sections.length > 0 ? (
              releaseInfo.sections.map((sec, idx) => {
                const isNew = sec.type === 'new';
                const isImproved = sec.type === 'improved';
                const color = isNew ? SECONDARY : isImproved ? PRIMARY : 'rgba(255,255,255,0.6)';
                const iconName = isNew ? 'check-circle' : isImproved ? 'arrow-circle-up' : 'done';

                return (
                  <View key={`${sec.title}-${idx}`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                      <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color, textTransform: 'uppercase', letterSpacing: 1.0 }}>
                        {sec.title}
                      </Text>
                    </View>
                    <View style={{ gap: 8 }}>
                      {sec.items.map((item, itemIdx) => (
                        <View key={itemIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                          <MaterialIcons name={iconName as any} size={15} color={color} style={{ marginTop: 2 }} />
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18, flex: 1 }}>
                            {item}
                          </Text>
                        </View>
                      ))}
                    </View>
                    {idx < releaseInfo.sections.length - 1 && (
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 14 }} />
                    )}
                  </View>
                );
              })
            ) : (
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SECONDARY }} />
                  <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 13, color: SECONDARY, textTransform: 'uppercase', letterSpacing: 1.0 }}>
                    New Features
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <MaterialIcons name="check-circle" size={15} color={SECONDARY} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18, flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#FFF' }}>Liquid Glass Interface:</Text> Reimagined tactile settings and audio screens with dynamic depth.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <MaterialIcons name="check-circle" size={15} color={SECONDARY} style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18, flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#FFF' }}>Lossless Caching:</Text> Streamlined Media3 offline playback pipelines.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </LiquidGlass>

        {/* Sticky Bottom Action */}
        <View style={{ paddingHorizontal: 24 }}>
          <PrimaryGlowButton
            label={`Update to ${targetVersion}`}
            icon="download"
            onPress={() => {
              setShowNotesSheet(false);
              startDownload();
            }}
          />
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: DOWNLOADING STATE ──────────────────────────────────────────
  if (phase === 'DOWNLOADING') {
    const pct = downloadProgress.percentage || 0;
    const downloadedMb = ((downloadProgress.bytesDownloaded || 0) / (1024 * 1024)).toFixed(1);
    const totalMb = ((downloadProgress.totalBytes || 1) / (1024 * 1024)).toFixed(1);

    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={styles.topBar}>
          <LiquidPill style={styles.pillIconBtn} onPress={cancelDownload}>
            <MaterialIcons name="close" size={20} color="#FFF" />
          </LiquidPill>
          <Text style={styles.topBarTitle}>Updating AuraMusic</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          {/* Circular Scrubber Progress Ring */}
          <CircularProgressRing percentage={pct} />

          <Text style={[styles.editorialTitle, { marginTop: 24, fontSize: 20 }]}>
            {pct >= 85 ? 'Preparing update...' : 'Downloading update...'}
          </Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
            {downloadedMb} MB of {totalMb} MB • {downloadProgress.speedText}
          </Text>

          {/* Floating Linear Bar Glass */}
          <LiquidGlass style={{ width: '100%', maxWidth: 320, padding: 16, marginTop: 24 }} r={20}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>
                AuraMusic {targetVersion}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.6)' }}>
                {pct >= 85 ? 'Verifying package...' : `${pct}% completed`}
              </Text>
            </View>
            <View style={styles.linearTrack}>
              <View style={[styles.linearFill, { width: `${pct}%` }]} />
            </View>
          </LiquidGlass>

          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', textAlign: 'center', maxWidth: 300, marginTop: 24, lineHeight: 16 }}>
            Your music playback won’t be interrupted while the update is downloading in the background.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, flexDirection: 'row', gap: 12 }}>
          <LiquidPill style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }} onPress={cancelDownload}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>Pause</Text>
          </LiquidPill>
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: READY TO INSTALL ───────────────────────────────────────────
  if (phase === 'READY_TO_INSTALL') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={styles.topBar}>
          <LiquidPill style={styles.pillIconBtn} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
          </LiquidPill>
          <Text style={styles.topBarTitle}>Software Update</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          {/* Verified Cyan Shield */}
          <View style={{ marginBottom: 20 }}>
            <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(70, 245, 224, 0.25)', filter: 'blur(20px)' as any }} />
            <LiquidGlass r={28} style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(70, 245, 224, 0.35)' }}>
              <MaterialIcons name="verified" size={36} color={SECONDARY} />
            </LiquidGlass>
          </View>

          <View style={[styles.inlineStatusBadge, { backgroundColor: 'rgba(70, 245, 224, 0.12)', borderColor: 'rgba(70, 245, 224, 0.25)' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: SECONDARY }}>Update verified & ready</Text>
          </View>

          <Text style={[styles.editorialTitle, { marginTop: 10, fontSize: 24 }]}>Update Ready</Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 8, lineHeight: 18 }}>
            AuraMusic {targetVersion} is downloaded and verified. The install takes less than 5 seconds and will relaunch cleanly.
          </Text>

          {/* Summary Pill */}
          <LiquidGlass r={20} style={{ width: '100%', maxWidth: 320, padding: 16, marginTop: 24, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Target Version</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{targetVersion} (Stable)</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Package Size</Text>
              <Text style={{ fontSize: 12, color: '#FFF' }}>{packageSize}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Playback Impact</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: SECONDARY }}>Session safely saved</Text>
            </View>
          </LiquidGlass>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <PrimaryGlowButton label="Install Update Now" icon="system-update-alt" onPress={installUpdate} />
          <LiquidPill style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => router.back()}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Not Now</Text>
          </LiquidPill>
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: INSTALLING STATE ───────────────────────────────────────────
  if (phase === 'INSTALLING') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={[styles.topBar, { justifyContent: 'center' }]}>
          <Text style={[styles.topBarTitle, { color: 'rgba(255,255,255,0.7)' }]}>AuraMusic</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(218, 185, 255, 0.35)' }} />
            <LiquidGlass r={20} style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={PRIMARY} />
            </LiquidGlass>
          </View>

          <Text style={[styles.editorialTitle, { fontSize: 22 }]}>Installing update...</Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 6, lineHeight: 18 }}>
            Applying Liquid Glass refinements and preparing package installation.
          </Text>

          <View style={{ width: 200, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 24 }}>
            <LinearGradient colors={[PRIMARY, SECONDARY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 10 }}>
            Finishing setup
          </Text>
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: UPDATE COMPLETE ────────────────────────────────────────────
  if (phase === 'COMPLETE') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={[styles.topBar, { justifyContent: 'center' }]}>
          <Text style={[styles.topBarTitle, { color: 'rgba(255,255,255,0.6)' }]}>AuraMusic V3</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ marginBottom: 24 }}>
            <LiquidGlass r={40} style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="done" size={40} color={SECONDARY} />
            </LiquidGlass>
          </View>

          <Text style={{ fontSize: 12, fontWeight: '700', color: SECONDARY, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
            Welcome to
          </Text>
          <Text style={[styles.editorialTitle, { fontSize: 28 }]}>AuraMusic Updated</Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 8, lineHeight: 18 }}>
            You’re now running <Text style={{ fontWeight: '700', color: '#FFF' }}>Version {targetVersion}</Text> with all the latest Liquid Glass enhancements and performance speedups.
          </Text>

          <LiquidGlass r={20} style={{ width: '100%', maxWidth: 320, padding: 16, marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialIcons name="music-note" size={22} color={PRIMARY} />
              <View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Your music is ready</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Playlists, downloads & settings intact</Text>
              </View>
            </View>
          </LiquidGlass>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <PrimaryGlowButton label="Continue to Music" onPress={() => router.replace('/(tabs)' as any)} />
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: CHECK FAILED / ERROR ───────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={styles.topBar}>
          <LiquidPill style={styles.pillIconBtn} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
          </LiquidPill>
          <Text style={styles.topBarTitle}>Software Update</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <LiquidGlass r={28} style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <MaterialIcons name="cloud-off" size={36} color="rgba(255,255,255,0.4)" />
          </LiquidGlass>

          <Text style={[styles.editorialTitle, { fontSize: 20 }]}>Couldn&apos;t check for updates</Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 8, lineHeight: 18 }}>
            {errorMessage || 'Please check your network connection and try again later. Your music and downloads are unaffected.'}
          </Text>

          <LiquidGlass r={16} style={{ width: '100%', maxWidth: 320, padding: 14, marginTop: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Current version</Text>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{installedVersion}</Text>
            </View>
          </LiquidGlass>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <PrimaryGlowButton label="Try Again" icon="replay" onPress={handleManualCheck} />
          <LiquidPill style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => router.back()}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>Return to Settings</Text>
          </LiquidPill>
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: UP TO DATE ────────────────────────────────────────────────
  if (phase === 'UP_TO_DATE' || (!hasUpdate && phase !== 'CHECKING')) {
    return (
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <AmbientNebula />
        <View style={styles.topBar}>
          <LiquidPill style={styles.pillIconBtn} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
          </LiquidPill>
          <Text style={styles.topBarTitle}>Software Update</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <LiquidGlass r={28} style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <MaterialIcons name="verified-user" size={36} color={PRIMARY} />
          </LiquidGlass>

          <Text style={[styles.editorialTitle, { fontSize: 24 }]}>You&apos;re Up to Date</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: PRIMARY, marginTop: 4 }}>
            AuraMusic {installedVersion}
          </Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 8, lineHeight: 18 }}>
            Your player has all the latest Sonic Nebula audio enhancements, codecs, and interface features.
          </Text>

          <View style={[styles.inlineStatusBadge, { marginTop: 24, backgroundColor: 'rgba(40, 37, 52, 0.65)' }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SECONDARY }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
              Last checked: {lastCheckedText}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 10 }}>
          <LiquidPill
            style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onPress={handleManualCheck}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <MaterialIcons name="sync" size={18} color={PRIMARY} />
            )}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>
              {isChecking ? 'Checking server...' : 'Check for Updates'}
            </Text>
          </LiquidPill>
        </View>
      </View>
    );
  }

  // ── RENDER VIEW: UPDATE AVAILABLE (PRIMARY STITCH HERO SCREEN) ─────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <AmbientNebula />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <LiquidPill style={styles.pillIconBtn} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={20} color="#FFF" />
        </LiquidPill>
        <Text style={styles.topBarTitle}>Software Update</Text>
        <LiquidPill style={styles.pillIconBtn} onPress={handleManualCheck} disabled={isChecking}>
          {isChecking ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <MaterialIcons name="sync" size={18} color="rgba(255,255,255,0.7)" />
          )}
        </LiquidPill>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Center Stage: Hero App Icon Emblem & Pulsing Nebula */}
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
          <View style={{ width: 96, height: 96, marginBottom: 16 }}>
            {/* Glowing aura */}
            <View
              style={{
                position: 'absolute',
                width: 96,
                height: 96,
                borderRadius: 28,
                backgroundColor: PRIMARY_CONTAINER,
                opacity: 0.5,
              }}
            />
            {/* Glass App Emblem */}
            <LiquidGlass r={28} style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient
                colors={['rgba(218, 185, 255, 0.3)', 'rgba(108, 55, 169, 0.4)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialIcons name="album" size={38} color={PRIMARY} />
              </LinearGradient>
              {/* Notification Dot */}
              <View style={styles.heroRedDot} />
            </LiquidGlass>
          </View>

          {/* Header Texts */}
          <View style={[styles.inlineStatusBadge, { marginBottom: 8 }]}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_RED }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: PRIMARY }}>New update available</Text>
          </View>
          <Text style={styles.editorialTitle}>AuraMusic {targetVersion}</Text>
          <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, textAlign: 'center', maxWidth: 300, marginTop: 6, lineHeight: 18 }}>
            {summaryText}
          </Text>
        </View>

        {/* Version Transition Glass Matrix */}
        <LiquidGlass r={28} style={{ padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Installed */}
            <View style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 }}>
                Installed
              </Text>
              <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 18, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {installedVersion}
              </Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                Current Build
              </Text>
            </View>

            {/* Available */}
            <View style={{ flex: 1, padding: 14, borderRadius: 18, backgroundColor: 'rgba(218, 185, 255, 0.10)', borderWidth: 1, borderColor: 'rgba(218, 185, 255, 0.25)' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: PRIMARY, letterSpacing: 0.5 }}>
                Available
              </Text>
              <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 18, color: '#FFF', marginTop: 2 }}>
                {targetVersion}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(218, 185, 255, 0.85)', marginTop: 4 }}>
                {packageSize} update
              </Text>
            </View>
          </View>

          {/* Highlight Preview Snippet */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="auto-awesome" size={16} color={SECONDARY} />
              <Text style={{ fontSize: 12, color: ON_SURFACE_VARIANT, fontWeight: '500' }}>
                {releaseDate} Release
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowNotesSheet(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: PRIMARY }}>Read Notes</Text>
              <MaterialIcons name="chevron-right" size={16} color={PRIMARY} />
            </TouchableOpacity>
          </View>
        </LiquidGlass>

        {/* Action Section: Update Primary CTA + View Notes Secondary */}
        <View style={{ gap: 10 }}>
          <PrimaryGlowButton label="Update AuraMusic" icon="download" onPress={startDownload} />
          <LiquidPill style={{ paddingVertical: 14, alignItems: 'center' }} onPress={() => setShowNotesSheet(true)}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>
              View Release Notes
            </Text>
          </LiquidPill>
        </View>

        {/* Metadata Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' }}>
            Current: {installedVersion}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' }}>
            Latest: {targetVersion}
          </Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' }}>
            Checked: {lastCheckedText}
          </Text>
        </View>

        {/* DEV-Only State Testing Toolbar (Gated behind __DEV__, matches Stitch selector) */}
        {__DEV__ && (
          <View style={{ marginTop: 24, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY }} />
                <Text style={{ fontSize: 10, fontFamily: 'Manrope_700Bold', color: PRIMARY, textTransform: 'uppercase', letterSpacing: 1.0 }}>
                  AuraMusic OS • Dev Stage Switcher
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(
                [
                  ['Available', 'UPDATE_AVAILABLE'],
                  ['Notes', 'NOTES'],
                  ['Downloading', 'DOWNLOADING'],
                  ['Ready', 'READY_TO_INSTALL'],
                  ['Installing', 'INSTALLING'],
                  ['Complete', 'COMPLETE'],
                  ['Up to Date', 'UP_TO_DATE'],
                  ['Error', 'ERROR'],
                ] as const
              ).map(([label, targetPhase]) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    Haptics.selectionAsync();
                    if (targetPhase === 'NOTES') {
                      setShowNotesSheet(true);
                    } else {
                      setShowNotesSheet(false);
                      setSimulatedPhase(targetPhase as any);
                    }
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#FFF' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  nebulaOrb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  pillIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
  },
  editorialTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 30,
    color: '#FFF',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  inlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(218, 185, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.25)',
  },
  heroRedDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: STATUS_RED,
    borderWidth: 2,
    borderColor: SURFACE,
  },
  latestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(218, 185, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.25)',
  },
  latestBadgeText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  linearTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  linearFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PRIMARY,
  },
});

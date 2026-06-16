import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useMemo,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
    Animated,
    Dimensions,
    Easing,
    LayoutAnimation,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
    Modal,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import Reanimated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing as REasing,
    interpolate,
    Extrapolation,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useLikesStore } from "@/src/features/likes/store/likes.store";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { useMediaCacheStore } from "@/src/features/cache/store/media-cache.store";
import { LocalMusicService } from "@/src/services/local-music.service";
import { MusicTrack } from "@/src/types/music";
import { PlayerTrack } from "@/src/features/player/types/player";
import { getTrackArtwork, getArtworkUrl } from "@/src/features/player/utils/track-identity";
import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import { PressScale } from "@/src/components/ui/press-scale";
import { palette, radius, spacing } from "@/src/design/tokens";
import { resolveArtwork } from "@/src/features/player/utils/artwork-resolver";
import { AuraArtwork } from "@/src/components/ui/aura-artwork";

// LayoutAnimation setup (handled by platform defaults in new arch)

// ─── Responsive Layout ────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get("window");

const isTablet = SW >= 768;
const isLargePhone = SW >= 414;

// Unified spacing scale: 4 8 12 16 20 24 32
const SP4 = 4;
const SP8 = 8;
const SP12 = 12;
const SP16 = 16;
const SP20 = 20;
const SP24 = 24;
const SP32 = 32;

const PAD = isTablet ? SP32 : isLargePhone ? SP24 : SP20;
const TRACK_ART = isTablet ? 64 : 52;
const CARD_GAP = isTablet ? SP20 : SP16;

// Folder grid: 2 cols on phone, 3 on tablet
const FOLDER_COLS = isTablet ? 3 : 2;
const FOLDER_CARD_W = (SW - PAD * 2 - CARD_GAP * (FOLDER_COLS - 1)) / FOLDER_COLS;

// ─── Colour constants (matching existing palette + liquid glass tints) ────────

const GLASS_TINT = "rgba(191,90,242,0.13)";
const GLASS_TINT_HI = "rgba(255,255,255,0.03)";
const SPEC_TOP = "rgba(255,255,255,0.18)";
// Subtle border used consistently throughout
const BORDER_SUBTLE = "rgba(255,255,255,0.08)";
const BORDER_ACTIVE = "rgba(168,72,255,0.32)";

const TABS = ["Songs", "Folders"] as const;
type Tab = typeof TABS[number];

// ─── Spring & timing configs ──────────────────────────────────────────────────

const SPRING_TAB = { damping: 22, stiffness: 280, mass: 0.8 };
// Staggered list entrance
const STAGGER_MS = 40;

// ─── WaveformBars: animated "now playing" indicator ──────────────────────────

const WaveformBars = () => {
    const bars = [
        useRef(new Animated.Value(0.4)).current,
        useRef(new Animated.Value(0.7)).current,
        useRef(new Animated.Value(0.5)).current,
    ];

    useEffect(() => {
        const anims = bars.map((bar, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.timing(bar, {
                        toValue: 1,
                        duration: 340 + i * 80,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                    Animated.timing(bar, {
                        toValue: 0.3,
                        duration: 340 + i * 80,
                        easing: Easing.inOut(Easing.sin),
                        useNativeDriver: true,
                    }),
                ])
            )
        );
        anims.forEach((a) => a.start());
        return () => anims.forEach((a) => a.stop());
    }, []);

    return (
        <View style={s.waveform}>
            {bars.map((bar, i) => (
                <Animated.View
                    key={i}
                    style={[
                        s.waveBar,
                        { transform: [{ scaleY: bar }] },
                    ]}
                />
            ))}
        </View>
    );
};

// ─── OnboardingModal ──────────────────────────────────────────────────────────

const OnboardingModal = React.memo(({
    visible,
    onGrantAccess,
    onDismiss,
}: {
    visible: boolean;
    onGrantAccess: () => void;
    onDismiss: () => void;
}) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
            <View style={s.onboardingOverlay}>
                <Animated.View style={[s.onboardingBackdrop, { opacity: opacityAnim }]} />
                <Animated.View style={[s.onboardingContent, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    <LiquidGlass borderRadius={32} intensity={26} style={s.onboardingGlass} contentStyle={{ alignItems: "center", width: "100%" }}>
                        <LinearGradient
                            colors={[GLASS_TINT, GLASS_TINT_HI]}
                            style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                            pointerEvents="none"
                        />
                        <View style={s.onboardingSpecular} pointerEvents="none" />

                        <View style={s.onboardingIconWrap}>
                            <LinearGradient
                                colors={["rgba(191,90,242,0.22)", "rgba(120,40,200,0.10)"]}
                                style={s.onboardingIconBg}
                            >
                                <Ionicons name="folder-open" size={44} color={palette.primary} />
                            </LinearGradient>
                        </View>

                        <Text style={s.onboardingTitle}>Access Your Music</Text>
                        <Text style={s.onboardingSub}>
                            AuraMusic needs access to your music folders to scan and play audio files stored on your device.
                        </Text>
                        <Text style={s.onboardingNote}>
                            Your files are never uploaded. We only scan them locally to build your offline library.
                        </Text>

                        <View style={s.onboardingActions}>
                            <PressScale
                                style={s.onboardingPrimaryBtn}
                                wrapperStyle={{ width: "100%" }}
                                onPress={onGrantAccess}
                                haptic={Haptics.ImpactFeedbackStyle.Medium}
                            >
                                <LinearGradient
                                    colors={[palette.primary, "#7B42F6"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <View style={s.onboardingBtnSpec} pointerEvents="none" />
                                <Ionicons name="folder-open" size={18} color="#fff" />
                                <Text style={s.onboardingPrimaryBtnText}>Grant Folder Access</Text>
                            </PressScale>

                            <PressScale
                                style={s.onboardingSecondaryBtn}
                                wrapperStyle={{ width: "100%" }}
                                onPress={onDismiss}
                                haptic={Haptics.ImpactFeedbackStyle.Light}
                            >
                                <Text style={s.onboardingSecondaryBtnText}>Not Now</Text>
                            </PressScale>
                        </View>
                    </LiquidGlass>
                </Animated.View>
            </View>
        </Modal>
    );
});

// ─── PermissionDeniedModal ─────────────────────────────────────────────────────

const PermissionDeniedModal = React.memo(({
    visible,
    onRetry,
    onDismiss,
}: {
    visible: boolean;
    onRetry: () => void;
    onDismiss: () => void;
}) => {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, tension: 65, friction: 11, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            scaleAnim.setValue(0.85);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
            <View style={s.onboardingOverlay}>
                <Animated.View style={[s.onboardingBackdrop, { opacity: opacityAnim }]} />
                <Animated.View style={[s.onboardingContent, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
                    <LiquidGlass borderRadius={28} intensity={26} style={s.onboardingGlass} contentStyle={{ alignItems: "center", width: "100%" }}>
                        <LinearGradient
                            colors={[GLASS_TINT, GLASS_TINT_HI]}
                            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                            pointerEvents="none"
                        />

                        <View style={s.deniedIconWrap}>
                            <LinearGradient
                                colors={["rgba(255,107,107,0.22)", "rgba(220,53,69,0.10)"]}
                                style={s.onboardingIconBg}
                            >
                                <Ionicons name="lock-closed" size={36} color={palette.coral} />
                            </LinearGradient>
                        </View>

                        <Text style={s.onboardingTitle}>Permission Required</Text>
                        <Text style={s.onboardingSub}>
                            Folder access was denied. Please enable it in your device settings to browse local music.
                        </Text>

                        <View style={s.onboardingActions}>
                            <PressScale
                                style={s.onboardingPrimaryBtn}
                                wrapperStyle={{ width: "100%" }}
                                onPress={onRetry}
                                haptic={Haptics.ImpactFeedbackStyle.Medium}
                            >
                                <LinearGradient
                                    colors={[palette.primary, "#7B42F6"]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <Text style={s.onboardingPrimaryBtnText}>Try Again</Text>
                            </PressScale>

                            <PressScale
                                style={s.onboardingSecondaryBtn}
                                wrapperStyle={{ width: "100%" }}
                                onPress={onDismiss}
                                haptic={Haptics.ImpactFeedbackStyle.Light}
                            >
                                <Text style={s.onboardingSecondaryBtnText}>Cancel</Text>
                            </PressScale>
                        </View>
                    </LiquidGlass>
                </Animated.View>
            </View>
        </Modal>
    );
});

// ─── LocalTrackRow ────────────────────────────────────────────────────────────

const LocalTrackRow = React.memo(
    ({
        track,
        onPlay,
        isActive,
        index,
    }: {
        track: MusicTrack;
        onPlay: (track: MusicTrack) => void;
        isActive?: boolean;
        index: number;
    }) => {
        const formatExt = (mime?: string) =>
            mime?.split("/")[1]?.toUpperCase().replace("MPEG", "MP3") ?? null;

        const cached = useMediaCacheStore((s) => s.metadata[track.id]?.track);
        const displayTitle = cached?.title || track.title;
        const displayArtist = (cached?.artist && cached.artist !== "Local Artist" && cached.artist !== "Local") ? cached.artist : (track.artist || "Local Audio");
        const cachedAny = cached as any;
        const displayArt = (cachedAny?.art || cachedAny?.artwork || cachedAny?.artworkUrl || cachedAny?.thumbnail || cachedAny?.image) 
            ? getArtworkUrl(cached, 'card') 
            : getArtworkUrl(track, 'card');

        const isLiked = useLikesStore((s) => !!s.likedTrackIds[track.id]);
        const toggleLike = useLikesStore((s) => s.toggleLike);

        // Staggered entrance — capped at index 20 for scroll performance
        const rowOpacity = useRef(new Animated.Value(index < 20 ? 0 : 1)).current;
        const rowTranslate = useRef(new Animated.Value(index < 20 ? 10 : 0)).current;
        useEffect(() => {
            if (index >= 20) return;
            const delay = index * STAGGER_MS;
            Animated.parallel([
                Animated.timing(rowOpacity, {
                    toValue: 1,
                    duration: 260,
                    delay,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(rowTranslate, {
                    toValue: 0,
                    duration: 260,
                    delay,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start();
        }, []);

        return (
            <Animated.View
                style={{
                    opacity: rowOpacity,
                    transform: [{ translateY: rowTranslate }],
                    paddingHorizontal: PAD,
                    marginBottom: SP12,
                }}
            >
                <PressScale
                    onPress={() => onPlay(track)}
                    haptic={Haptics.ImpactFeedbackStyle.Light}
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${displayTitle}${isActive ? ", currently playing" : ""}`}
                >
                    <LiquidGlass
                        borderRadius={20}
                        intensity={isActive ? 26 : 16}
                        style={[s.trackGlass, isActive && s.trackGlassActive]}
                    >
                        {/* Active track: purple tint overlay */}
                        {isActive && (
                            <LinearGradient
                                colors={["rgba(168,72,255,0.14)", "rgba(120,40,220,0.06)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                                pointerEvents="none"
                            />
                        )}

                        {/* Top specular edge */}
                        <View style={s.trackSpecular} pointerEvents="none" />

                        <View style={s.trackInner}>
                            {/* Artwork / fallback */}
                            <View style={s.trackArtWrap}>
                                <AuraArtwork
                                    source={resolveArtwork(track, 'card')}
                                    entityName={displayTitle}
                                    entityType="song"
                                    style={s.trackArt}
                                    contentFit="cover"
                                    transition={250}
                                    cachePolicy="memory-disk"
                                    borderRadius={12}
                                />

                                {/* Active badge: waveform animation */}
                                {isActive && (
                                    <View style={s.activeBadge}>
                                        <WaveformBars />
                                    </View>
                                )}
                            </View>

                            {/* Text info */}
                            <View style={s.trackInfo}>
                                <Text
                                    style={[s.trackTitle, isActive && s.trackTitleActive]}
                                    numberOfLines={1}
                                >
                                    {displayTitle}
                                </Text>
                                <View style={s.trackMeta}>
                                    <Text style={s.trackArtist} numberOfLines={1}>
                                        {displayArtist}
                                    </Text>
                                    {formatExt(track.mimeType) && (
                                        <View style={s.mimeBadge}>
                                            <Text style={s.mimeText}>{formatExt(track.mimeType)}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Duration + chevron */}
                            <View style={s.trackRight}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            toggleLike({
                                                id: track.id,
                                                title: displayTitle,
                                                artist: displayArtist,
                                                art: displayArt || "",
                                                url: track.url || "",
                                                duration: 0,
                                                isLocal: true,
                                                source: "local"
                                            });
                                        }}
                                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                                        accessibilityLabel={isLiked ? "Unlike" : "Like"}
                                        accessibilityRole="button"
                                    >
                                        <Ionicons
                                            name={isLiked ? "heart" : "heart-outline"}
                                            size={18}
                                            color={isLiked ? palette.primary : "rgba(255,255,255,0.18)"}
                                        />
                                    </TouchableOpacity>
                                    <Text style={s.trackDur}>{track.time || "--:--"}</Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color="rgba(255,255,255,0.18)"
                                />
                            </View>
                        </View>
                    </LiquidGlass>
                </PressScale>
            </Animated.View>
        );
    }
);

// ─── FolderCard ───────────────────────────────────────────────────────────────

const FolderCard = React.memo(
    ({
        name,
        count,
        onPress,
        index = 0,
    }: {
        name: string;
        count: number;
        onPress: () => void;
        index?: number;
    }) => {
        const cardOpacity = useRef(new Animated.Value(0)).current;
        const cardScale = useRef(new Animated.Value(0.94)).current;
        useEffect(() => {
            Animated.parallel([
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 300,
                    delay: index * STAGGER_MS,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(cardScale, {
                    toValue: 1,
                    duration: 300,
                    delay: index * STAGGER_MS,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
            ]).start();
        }, []);

        return (
            <Animated.View style={{ width: FOLDER_CARD_W, opacity: cardOpacity, transform: [{ scale: cardScale }] }}>
                <PressScale
                    style={{ flex: 1 }}
                    onPress={onPress}
                    haptic={Haptics.ImpactFeedbackStyle.Medium}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${count} tracks`}
                >
                    <LiquidGlass
                        borderRadius={24}
                        intensity={22}
                        style={s.folderGlass}
                    >
                        {/* Glass tint */}
                        <LinearGradient
                            colors={[GLASS_TINT, GLASS_TINT_HI]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
                            pointerEvents="none"
                        />

                        {/* Top specular */}
                        <View style={s.folderSpecular} pointerEvents="none" />

                        {/* Count badge — top right */}
                        <View style={s.folderTop}>
                            <View style={s.folderBadge}>
                                <Text style={s.folderBadgeText}>{count}</Text>
                            </View>
                        </View>

                        {/* Icon */}
                        <View style={s.folderIconWrap}>
                            <LinearGradient
                                colors={["rgba(191,90,242,0.22)", "rgba(120,40,200,0.10)"]}
                                style={s.folderIconBg}
                            >
                                <Ionicons name="folder-open" size={28} color={palette.primary} />
                            </LinearGradient>
                        </View>

                        {/* Name */}
                        <View style={s.folderBottom}>
                            <Text style={s.folderName} numberOfLines={2}>
                                {name}
                            </Text>
                            <Text style={s.folderSub}>
                                {count} {count === 1 ? "track" : "tracks"}
                            </Text>
                        </View>
                    </LiquidGlass>
                </PressScale>
            </Animated.View>
        );
    }
);

// ─── ManagedFolderRow ─────────────────────────────────────────────────────────

const ManagedFolderRow = React.memo(
    ({
        uri,
        onRemove,
    }: {
        uri: string;
        onRemove: () => void;
    }) => {
        const name = decodeURIComponent(uri).split("/").pop() || uri;
        return (
            <View style={s.managedRow}>
                <View style={s.managedIconWrap}>
                    <Ionicons name="folder" size={18} color={palette.primary} />
                </View>
                <Text style={s.managedText} numberOfLines={1}>
                    {name}
                </Text>
                <TouchableOpacity
                    onPress={onRemove}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={`Remove folder ${name}`}
                    accessibilityRole="button"
                >
                    <Ionicons name="close-circle" size={22} color={palette.coral} />
                </TouchableOpacity>
            </View>
        );
    }
);

// ─── TabBar: animated pill indicator ─────────────────────────────────────────

const TabBar = ({
    activeTab,
    onSelect,
}: {
    activeTab: Tab;
    onSelect: (tab: Tab) => void;
}) => {
    const [tabW, setTabW] = useState(0);
    const pillX = useSharedValue(0);

    useLayoutEffect(() => {
        if (tabW === 0) return;
        const idx = TABS.indexOf(activeTab);
        pillX.value = withSpring(idx * tabW, SPRING_TAB);
    }, [activeTab, tabW]);

    const pillStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: pillX.value }],
    }));

    return (
        <View style={s.tabsContainer}>
            <LiquidGlass borderRadius={22} intensity={16} style={s.tabsGlass}>
                {/* Specular top */}
                <View style={s.tabSpecular} pointerEvents="none" />

                <View
                    style={s.tabsInner}
                    onLayout={(e) => {
                        const w = e.nativeEvent.layout.width / TABS.length;
                        setTabW(w);
                    }}
                >
                    {/* Sliding pill (background) */}
                    {tabW > 0 && (
                        <Reanimated.View
                            style={[s.tabPill, { width: tabW }, pillStyle]}
                            pointerEvents="none"
                        >
                            <LinearGradient
                                colors={["rgba(218,185,255,0.88)", "rgba(123,66,246,0.88)"]}
                                style={StyleSheet.absoluteFill}
                            />
                            {/* Pill specular */}
                            <View style={s.pillSpecular} pointerEvents="none" />
                        </Reanimated.View>
                    )}

                    {/* Tab buttons */}
                    {TABS.map((tab) => {
                        const active = activeTab === tab;
                        return (
                            <Pressable
                                key={tab}
                                style={s.tabBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onSelect(tab);
                                }}
                                accessibilityRole="tab"
                                accessibilityLabel={tab}
                                accessibilityState={{ selected: active }}
                            >
                                <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                                    {tab}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </LiquidGlass>
        </View>
    );
};

// ─── LoadingState ─────────────────────────────────────────────────────────────

const LoadingState = () => {
    const pulse = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={s.stateCenter}>
            <Animated.View style={{ opacity: pulse }}>
                <LiquidGlass borderRadius={32} intensity={22} style={s.loaderGlass}>
                    <LinearGradient
                        colors={[GLASS_TINT, GLASS_TINT_HI]}
                        style={StyleSheet.absoluteFill}
                    />
                    <Ionicons name="musical-notes" size={36} color={palette.primary} />
                </LiquidGlass>
            </Animated.View>
            <Text style={s.stateTitle}>Gathering your music</Text>
            <Text style={s.stateSub}>Scanning local files and building your library.</Text>
        </View>
    );
};

// ─── EmptyGrantState ──────────────────────────────────────────────────────────

const EmptyGrantState = ({
    onGrant,
}: {
    onGrant: () => void;
}) => (
    <View style={s.stateContainer}>
        <LiquidGlass borderRadius={32} intensity={22} style={s.stateGlass}>
            <LinearGradient
                colors={[GLASS_TINT, GLASS_TINT_HI]}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                pointerEvents="none"
            />
            <View style={s.stateSpecular} pointerEvents="none" />

            <View style={s.stateIconWrap}>
                <LinearGradient
                    colors={["rgba(191,90,242,0.22)", "rgba(120,40,200,0.10)"]}
                    style={s.stateIconBg}
                >
                    <Ionicons name="folder-open-outline" size={40} color={palette.primary} />
                </LinearGradient>
            </View>

            <Text style={s.stateTitle}>Folder Access Required</Text>
            <Text style={s.stateSub}>
                Grant access to your music folders to start playing offline tracks.
            </Text>

            <PressScale
                style={s.primaryBtn}
                onPress={onGrant}
                haptic={Haptics.ImpactFeedbackStyle.Medium}
                accessibilityLabel="Grant music folder access"
                accessibilityRole="button"
            >
                <LinearGradient
                    colors={[palette.primary, "#7B42F6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                />
                <View style={s.primaryBtnSpec} pointerEvents="none" />
                <Ionicons name="folder-open" size={18} color="#fff" />
                <Text style={s.primaryBtnTxt}>Grant Music Folder Access</Text>
            </PressScale>
        </LiquidGlass>
    </View>
);

// ─── EmptyNoTracksState ───────────────────────────────────────────────────────

const EmptyNoTracksState = ({
    onAddFolder,
    onScan,
}: {
    onAddFolder: () => void;
    onScan: () => void;
}) => (
    <View style={s.stateContainer}>
        <LiquidGlass borderRadius={32} intensity={22} style={s.stateGlass}>
            <LinearGradient
                colors={[GLASS_TINT, GLASS_TINT_HI]}
                style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
                pointerEvents="none"
            />
            <View style={s.stateSpecular} pointerEvents="none" />

            <View style={s.stateIconWrap}>
                <LinearGradient
                    colors={["rgba(191,90,242,0.22)", "rgba(120,40,200,0.10)"]}
                    style={s.stateIconBg}
                >
                    <Ionicons name="musical-notes-outline" size={40} color={palette.primary} />
                </LinearGradient>
            </View>

            <Text style={s.stateTitle}>No music found</Text>
            <Text style={s.stateSub}>
                We couldn't find any supported audio files in the granted folders.
            </Text>

            <View style={s.dualBtnRow}>
                <PressScale
                    style={[s.primaryBtn, { flex: 1 }]}
                    onPress={onAddFolder}
                    haptic={Haptics.ImpactFeedbackStyle.Medium}
                    accessibilityLabel="Add folder"
                    accessibilityRole="button"
                >
                    <LinearGradient
                        colors={[palette.primary, "#7B42F6"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={s.primaryBtnSpec} pointerEvents="none" />
                    <Text style={s.primaryBtnTxt}>Add Folder</Text>
                </PressScale>

                <PressScale
                    style={[s.ghostBtn, { flex: 1 }]}
                    onPress={onScan}
                    haptic={Haptics.ImpactFeedbackStyle.Light}
                    accessibilityLabel="Scan again"
                    accessibilityRole="button"
                >
                    <Text style={s.ghostBtnTxt}>Scan Again</Text>
                </PressScale>
            </View>
        </LiquidGlass>
    </View>
);

// ─── HeroCard ─────────────────────────────────────────────────────────────────

const HeroCard = ({
    trackCount,
    folderCount,
}: {
    trackCount: number;
    folderCount: number;
}) => (
    <View style={s.heroSection}>
        <LiquidGlass borderRadius={28} intensity={22} style={s.heroGlass}>
            <LinearGradient
                colors={[GLASS_TINT, GLASS_TINT_HI]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                pointerEvents="none"
            />
            <View style={s.heroSpecular} pointerEvents="none" />

            <View style={s.heroContent}>
                {/* Left: text */}
                <View style={s.heroLeft}>
                    <Text style={s.heroTitle}>Your offline universe</Text>
                    <Text style={s.heroSub}>
                        Immersive local playback, always available.
                    </Text>
                </View>

                {/* Right: icon */}
                <LinearGradient
                    colors={["rgba(191,90,242,0.24)", "rgba(90,20,160,0.12)"]}
                    style={s.heroIconWrap}
                >
                    <Ionicons name="library" size={26} color={palette.primary} />
                </LinearGradient>
            </View>

            {/* Stats row */}
            <View style={s.heroStats}>
                <View style={s.heroStatItem}>
                    <Text style={s.heroStatNum}>{trackCount}</Text>
                    <Text style={s.heroStatLabel}>Tracks</Text>
                </View>
                <View style={s.heroStatDivider} />
                <View style={s.heroStatItem}>
                    <Text style={s.heroStatNum}>{folderCount}</Text>
                    <Text style={s.heroStatLabel}>Folders</Text>
                </View>
                <View style={s.heroStatDivider} />
                <View style={s.heroStatItem}>
                    <Text style={s.heroStatNum}>
                        {trackCount > 0 ? `${Math.ceil(trackCount * 3.5)}m` : "0m"}
                    </Text>
                    <Text style={s.heroStatLabel}>Est. playtime</Text>
                </View>
            </View>
        </LiquidGlass>
    </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LocalLibraryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const setQueue = usePlayerStore(s => s.setQueue);
    const currentTrack = usePlayerStore(s => s.currentTrack);
    const setActiveContext = usePlayerStore(s => s.setActiveContext);

    const [activeTab, setActiveTab] = useState<Tab>("Songs");
    const [isLoading, setIsLoading] = useState(true);
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [folders, setFolders] = useState<Record<string, MusicTrack[]>>({});
    const [grantedFolders, setGrantedFolders] = useState<string[]>([]);

    // Onboarding state
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showPermissionDenied, setShowPermissionDenied] = useState(false);
    const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

    // Rotate icon animation (refresh)
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const spinOnce = useCallback(() => {
        Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        }).start(() => rotateAnim.setValue(0));
    }, [rotateAnim]);

    const rotateStyle = {
        transform: [
            {
                rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                }),
            },
        ],
    };

    const loadLocalMedia = useCallback(async () => {
        setIsLoading(true);
        spinOnce();
        try {
            const hasPerm = await LocalMusicService.hasPermission();
            if (hasPerm) {
                setGrantedFolders(["Device Storage"]);
                const localTracks = await LocalMusicService.getLocalTracks();
                
                const cacheStore = useMediaCacheStore.getState();
                const decoratedTracks = localTracks.map(track => {
                    const cached = cacheStore.getCachedTrack(track.id);
                    if (cached && cached.track) {
                        return {
                            ...track,
                            title: cached.track.title || track.title,
                            artist: cached.track.artist || track.artist,
                            art: cached.track.art || track.art,
                            album: cached.track.album || track.album,
                        };
                    }
                    return track;
                });

                setTracks(decoratedTracks);
                setFolders(LocalMusicService.groupByFolder(decoratedTracks));
            } else {
                setGrantedFolders([]);
                setTracks([]);
                setFolders({});
            }
        } catch (e) {
            // Error handled via UI state - no logging needed in production
        } finally {
            setIsLoading(false);
            setHasInitiallyLoaded(true);
        }
    }, [spinOnce]);

    // First access check
    useEffect(() => {
        const checkFirstAccess = async () => {
            const hasAccess = await LocalMusicService.hasAccessedBefore();
            const hasPerm = await LocalMusicService.hasPermission();

            // If first time AND no permission granted yet, show onboarding
            if (!hasAccess && !hasPerm) {
                setShowOnboarding(true);
            } else {
                loadLocalMedia();
            }
        };

        checkFirstAccess();
    }, []);

    const handleGrantAccess = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowOnboarding(false);

        try {
            // First request media permissions
            const hasPerm = await LocalMusicService.requestPermissions();

            if (hasPerm) {
                await LocalMusicService.markFirstAccess();
                loadLocalMedia();
            } else {
                setShowPermissionDenied(true);
            }
        } catch (e) {
            console.error("[LocalLibrary] Grant access failed:", e);
            setShowPermissionDenied(true);
        }
    };

    const handleRetryPermission = async () => {
        setShowPermissionDenied(false);
        const hasPerm = await LocalMusicService.requestPermissions();

        if (hasPerm) {
            handleGrantAccess();
        } else {
            setShowPermissionDenied(true);
        }
    };

    const handleOnboardingDismiss = async () => {
        setShowOnboarding(false);
        await LocalMusicService.markFirstAccess();
        loadLocalMedia();
    };

    const handleRemoveFolder = async (uri: string) => {
        // Clear media state since we only have Device Storage
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setGrantedFolders([]);
        setTracks([]);
        setFolders({});
    };

    const handlePlayTrack = useCallback(
        (track: MusicTrack, list: MusicTrack[] = tracks) => {
            const cacheStore = useMediaCacheStore.getState();
            const playerTracks: PlayerTrack[] = list.map((t) => {
                const cached = cacheStore.getCachedTrack(t.id);
                return {
                    id: t.id,
                    title: cached?.track?.title || t.title,
                    artist: (cached?.track?.artist && cached.track.artist !== "Local Artist" && cached.track.artist !== "Local") ? cached.track.artist : (t.artist || "Local"),
                    art: cached?.track?.art || t.art || "",
                    url: t.url || t.localUri || "",
                    isLocal: true,
                    duration: 0,
                    mimeType: t.mimeType,
                };
            });
            const startIndex = playerTracks.findIndex((t) => t.id === track.id);

            setActiveContext({ type: "local", id: "local" });
            setQueue(playerTracks, startIndex !== -1 ? startIndex : 0, {
                sourceId: "local",
                sourceType: "manual",
                generatedAt: Date.now()
            });
            // Removed navigation to /now_playing
        },
        [setQueue, tracks]
    );

    const sortedFolders = useMemo(
        () => Object.entries(folders).sort((a, b) => b[1].length - a[1].length),
        [folders]
    );

    const renderContent = () => {
        if (isLoading) return <LoadingState />;

        if (grantedFolders.length === 0) {
            return <EmptyGrantState onGrant={handleGrantAccess} />;
        }

        if (tracks.length === 0) {
            return (
                <EmptyNoTracksState
                    onAddFolder={handleGrantAccess}
                    onScan={loadLocalMedia}
                />
            );
        }

        if (activeTab === "Songs") {
            return null; // Handled by FlashList now
        }

        if (activeTab === "Folders") {
            return (
                <View style={s.folderContainer}>
                    {/* Folder grid */}
                    <View style={s.folderGrid}>
                        {sortedFolders.map(([name, folderTracks], i) => (
                            <FolderCard
                                key={`${name}-${i}`}
                                name={name}
                                count={folderTracks.length}
                                index={i}
                                onPress={() => handlePlayTrack(folderTracks[0], folderTracks)}
                            />
                        ))}
                    </View>

                    {/* Manage section */}
                    <View style={s.manageSection}>
                        <View style={s.manageTitleRow}>
                            <Text style={s.manageTitle}>Managed Folders</Text>
                            <View style={s.manageTitleBadge}>
                                <Text style={s.manageTitleBadgeText}>{grantedFolders.length}</Text>
                            </View>
                        </View>

                        <LiquidGlass borderRadius={20} intensity={16} style={s.managedGlass}>
                            <View style={s.managedSpecular} pointerEvents="none" />
                            {grantedFolders.map((uri, i) => (
                                <React.Fragment key={`${uri}-${i}`}>
                                    <ManagedFolderRow
                                        uri={uri}
                                        onRemove={() => handleRemoveFolder(uri)}
                                    />
                                    {i < grantedFolders.length - 1 && (
                                        <View style={s.managedDivider} />
                                    )}
                                </React.Fragment>
                            ))}
                        </LiquidGlass>

                        {/* Add folder CTA */}
                        <PressScale
                            style={s.addFolderBtn}
                            onPress={handleGrantAccess}
                            haptic={Haptics.ImpactFeedbackStyle.Medium}
                            accessibilityLabel="Add folder"
                            accessibilityRole="button"
                        >
                            <Ionicons name="add" size={18} color={palette.primary} />
                            <Text style={s.addFolderBtnText}>Add Folder</Text>
                        </PressScale>
                    </View>
                </View>
            );
        }

        return null;
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Background gradients */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={["#131318", "#0f0f13"]}
                    style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                    colors={["rgba(191,90,242,0.18)", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.bgGlowOne}
                />
                <LinearGradient
                    colors={["rgba(70,245,224,0.08)", "transparent"]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.bgGlowTwo}
                />
            </View>

            <FlashList
                data={activeTab === "Songs" && !isLoading && grantedFolders.length > 0 && tracks.length > 0 ? tracks : []}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[s.scroll, { paddingBottom: 140 + insets.bottom }]}
                // @ts-expect-error FlashList types mismatch in this version
                estimatedItemSize={70}
                renderItem={({ item: t, index: i }) => (
                    <LocalTrackRow
                        track={t}
                        index={i}
                        onPlay={(track) => handlePlayTrack(track, tracks)}
                        isActive={currentTrack?.id === t.id}
                    />
                )}
                keyExtractor={(t, idx) => `${t.id || 'local'}-${idx}`}
                ListHeaderComponent={
                    <View>
                        {/* ── Header ─────────────────────────────────────────────── */}
                        <View style={[s.header, { paddingTop: insets.top + SP16 }]}>
                            {/* Back button */}
                            <PressScale
                                onPress={() => router.back()}
                                haptic={Haptics.ImpactFeedbackStyle.Light}
                                accessibilityLabel="Go back"
                                accessibilityRole="button"
                            >
                                <LiquidGlass borderRadius={20} intensity={16} style={s.iconBtn}>
                                    <View style={s.iconBtnSpec} pointerEvents="none" />
                                    <Ionicons name="chevron-back" size={20} color={palette.ink} />
                                </LiquidGlass>
                            </PressScale>

                            {/* Title block */}
                            <View style={s.headerMid}>
                                <Text style={s.headerEyebrow}>Device Music</Text>
                                <Text style={s.headerTitle}>Local Library</Text>
                                {tracks.length > 0 && (
                                    <View style={s.headerBadge}>
                                        <View style={s.headerDot} />
                                        <Text style={s.headerSub}>{tracks.length} songs</Text>
                                    </View>
                                )}
                            </View>

                            {/* Refresh button */}
                            <PressScale
                                onPress={loadLocalMedia}
                                disabled={isLoading}
                                haptic={Haptics.ImpactFeedbackStyle.Light}
                                accessibilityLabel="Refresh library"
                                accessibilityRole="button"
                            >
                                <LiquidGlass borderRadius={20} intensity={16} style={s.iconBtn}>
                                    <View style={s.iconBtnSpec} pointerEvents="none" />
                                    <Animated.View style={rotateStyle}>
                                        <Ionicons
                                            name="reload"
                                            size={18}
                                            color={isLoading ? palette.inkDim : palette.primary}
                                        />
                                    </Animated.View>
                                </LiquidGlass>
                            </PressScale>
                        </View>

                        {/* ── Hero card (only when we have data) ─────────────────── */}
                        {!isLoading && tracks.length > 0 && (
                            <HeroCard
                                trackCount={tracks.length}
                                folderCount={sortedFolders.length}
                            />
                        )}

                        {/* ── Tab bar (only when we have data) ───────────────────── */}
                        {!isLoading && tracks.length > 0 && (
                            <TabBar activeTab={activeTab} onSelect={setActiveTab} />
                        )}

                        {/* ── Main content ────────────────────────────────────────── */}
                        {renderContent()}
                    </View>
                }
                ListFooterComponent={
                    activeTab === "Songs" && !isLoading && grantedFolders.length > 0 && tracks.length > 0 ? (
                        <View style={s.songsList}>
                            <PressScale
                                style={s.addMoreRow}
                                onPress={handleGrantAccess}
                                haptic={Haptics.ImpactFeedbackStyle.Light}
                                accessibilityLabel="Add more folders to scan"
                                accessibilityRole="button"
                            >
                                <View style={s.addMoreInner}>
                                    <Ionicons name="add-circle-outline" size={20} color={palette.primary} />
                                    <Text style={s.addMoreText}>Add more folders</Text>
                                </View>
                            </PressScale>
                        </View>
                    ) : null
                }
            />

            {/* Onboarding Modal */}
            <OnboardingModal
                visible={showOnboarding}
                onGrantAccess={handleGrantAccess}
                onDismiss={handleOnboardingDismiss}
            />

            {/* Permission Denied Modal */}
            <PermissionDeniedModal
                visible={showPermissionDenied}
                onRetry={handleRetryPermission}
                onDismiss={() => setShowPermissionDenied(false)}
            />
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: palette.background,
    },

    scroll: {
        flexGrow: 1,
    },

    // ── Background
    bgGlowOne: {
        position: "absolute",
        width: 340,
        height: 340,
        borderRadius: 170,
        top: -100,
        left: -110,
    },
    bgGlowTwo: {
        position: "absolute",
        width: 280,
        height: 280,
        borderRadius: 140,
        top: 100,
        right: -90,
    },

    // ── Header
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: PAD,
        marginBottom: SP24,
        gap: SP16,
    },
    iconBtn: {
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    iconBtnSpec: {
        position: "absolute",
        top: 0,
        left: SP8,
        right: SP8,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.16)",
        borderRadius: 0.5,
    },
    headerMid: {
        flex: 1,
    },
    headerEyebrow: {
        fontSize: 10,
        color: palette.primary,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: SP4,
        opacity: 0.85,
    },
    headerTitle: {
        fontSize: isTablet ? 34 : 28,
        fontWeight: "900",
        color: palette.ink,
        letterSpacing: -1.0,
        lineHeight: isTablet ? 40 : 34,
    },
    headerBadge: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: SP4,
        gap: SP8,
    },
    headerDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: palette.primary,
        opacity: 0.9,
    },
    headerSub: {
        fontSize: 12,
        color: palette.inkMuted,
        fontWeight: "600",
        letterSpacing: 0.1,
    },

    // ── Hero card
    heroSection: {
        paddingHorizontal: PAD,
        marginBottom: SP20,
    },
    heroGlass: {
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    heroSpecular: {
        position: "absolute",
        top: 0,
        left: SP24,
        right: SP24,
        height: 1,
        backgroundColor: SPEC_TOP,
        borderRadius: 0.5,
    },
    heroContent: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: SP24,
        paddingBottom: SP20,
        gap: SP16,
    },
    heroLeft: {
        flex: 1,
    },
    heroTitle: {
        color: palette.ink,
        fontSize: isTablet ? 21 : 18,
        fontWeight: "800",
        letterSpacing: -0.4,
        marginBottom: SP8,
        lineHeight: isTablet ? 26 : 24,
    },
    heroSub: {
        color: palette.inkMuted,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: "500",
        opacity: 0.9,
    },
    heroIconWrap: {
        width: 50,
        height: 50,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    heroStats: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SP24,
        paddingTop: SP16,
        paddingBottom: SP20,
        borderTopWidth: 0.5,
        borderTopColor: "rgba(255,255,255,0.07)",
        gap: 0,
    },
    heroStatItem: {
        flex: 1,
        alignItems: "center",
        gap: SP4,
    },
    heroStatDivider: {
        width: 0.5,
        height: 28,
        backgroundColor: "rgba(255,255,255,0.10)",
    },
    heroStatNum: {
        color: palette.primary,
        fontSize: isTablet ? 24 : 20,
        fontWeight: "900",
        letterSpacing: -0.6,
    },
    heroStatLabel: {
        color: palette.inkMuted,
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },

    // ── Tab bar
    tabsContainer: {
        paddingHorizontal: PAD,
        marginBottom: SP20,
    },
    tabsGlass: {
        height: 50,
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    tabSpecular: {
        position: "absolute",
        top: 0,
        left: SP16,
        right: SP16,
        height: 1,
        backgroundColor: SPEC_TOP,
        borderRadius: 0.5,
        zIndex: 10,
    },
    tabsInner: {
        flex: 1,
        flexDirection: "row",
        margin: SP4,
        position: "relative",
    },
    tabPill: {
        position: "absolute",
        top: 0,
        bottom: 0,
        borderRadius: 15,
        overflow: "hidden",
    },
    pillSpecular: {
        position: "absolute",
        top: 0,
        left: SP12,
        right: SP12,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.32)",
        borderRadius: 0.5,
    },
    tabBtn: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        minHeight: 44,
    },
    tabTxt: {
        fontSize: 14,
        fontWeight: "600",
        color: palette.inkMuted,
        letterSpacing: 0.1,
    },
    tabTxtActive: {
        color: "#fff",
        fontWeight: "800",
        letterSpacing: 0,
    },

    // ── Songs list
    songsList: {
        paddingHorizontal: PAD,
        gap: SP8,
    },

    // Track row
    trackGlass: {
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    trackGlassActive: {
        borderColor: BORDER_ACTIVE,
    },
    trackSpecular: {
        position: "absolute",
        top: 0,
        left: SP16,
        right: SP16,
        height: 0.5,
        backgroundColor: SPEC_TOP,
        zIndex: 1,
    },
    trackInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SP16,
        paddingVertical: SP12,
        gap: SP12,
    },
    trackArtWrap: {
        position: "relative",
        flexShrink: 0,
    },
    trackArt: {
        width: TRACK_ART,
        height: TRACK_ART,
        borderRadius: 12,
    },
    trackFallback: {
        width: TRACK_ART,
        height: TRACK_ART,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    activeBadge: {
        position: "absolute",
        right: -5,
        bottom: -5,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "rgba(19,19,24,0.95)",
        borderWidth: 1,
        borderColor: "rgba(168,72,255,0.40)",
        justifyContent: "center",
        alignItems: "center",
    },

    // Waveform bars
    waveform: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        height: 12,
    },
    waveBar: {
        width: 2.5,
        height: 11,
        borderRadius: 1.5,
        backgroundColor: palette.primary,
        transformOrigin: "bottom",
    },

    trackInfo: {
        flex: 1,
        gap: SP4,
        minWidth: 0,
    },
    trackTitle: {
        fontSize: isTablet ? 16 : 14,
        color: palette.ink,
        fontWeight: "700",
        letterSpacing: -0.1,
        lineHeight: isTablet ? 22 : 20,
    },
    trackTitleActive: {
        color: palette.primary,
    },
    trackMeta: {
        flexDirection: "row",
        alignItems: "center",
        gap: SP8,
        flexWrap: "nowrap",
    },
    trackArtist: {
        fontSize: 12,
        color: palette.inkMuted,
        fontWeight: "500",
        flexShrink: 1,
        lineHeight: 16,
    },
    mimeBadge: {
        backgroundColor: "rgba(191,90,242,0.12)",
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 0.5,
        borderColor: "rgba(191,90,242,0.20)",
        flexShrink: 0,
    },
    mimeText: {
        color: palette.primary,
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
    trackRight: {
        alignItems: "flex-end",
        gap: SP4,
        flexShrink: 0,
    },
    trackDur: {
        fontSize: 12,
        color: "rgba(255,255,255,0.28)",
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
        lineHeight: 16,
    },

    // Add more row
    addMoreRow: {
        marginTop: SP8,
        paddingVertical: SP12,
    },
    addMoreInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SP8,
        opacity: 0.6,
    },
    addMoreText: {
        color: palette.primary,
        fontSize: 14,
        fontWeight: "600",
    },

    // ── Folders tab
    folderContainer: {
        paddingBottom: SP32,
    },
    folderGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: PAD,
        gap: CARD_GAP,
    },
    folderGlass: {
        aspectRatio: 1,
        padding: SP16,
        justifyContent: "space-between",
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    folderSpecular: {
        position: "absolute",
        top: 0,
        left: SP12,
        right: SP12,
        height: 1,
        backgroundColor: SPEC_TOP,
        zIndex: 1,
    },
    folderTop: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },
    folderBadge: {
        backgroundColor: "rgba(191,90,242,0.16)",
        paddingHorizontal: SP8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: "rgba(191,90,242,0.26)",
    },
    folderBadgeText: {
        color: palette.primary,
        fontSize: 11,
        fontWeight: "800",
    },
    folderIconWrap: {
        alignSelf: "flex-start",
    },
    folderIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    folderBottom: {
        gap: SP4,
    },
    folderName: {
        color: palette.ink,
        fontSize: isTablet ? 14 : 13,
        fontWeight: "800",
        letterSpacing: -0.2,
        lineHeight: 17,
    },
    folderSub: {
        color: palette.inkMuted,
        fontSize: 11,
        fontWeight: "500",
    },

    // ── Manage folders
    manageSection: {
        marginTop: SP32,
        paddingHorizontal: PAD,
    },
    manageTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SP8,
        marginBottom: SP16,
    },
    manageTitle: {
        color: palette.ink,
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: -0.3,
    },
    manageTitleBadge: {
        backgroundColor: "rgba(191,90,242,0.12)",
        paddingHorizontal: SP8,
        paddingVertical: 3,
        borderRadius: 7,
    },
    manageTitleBadgeText: {
        color: palette.primary,
        fontSize: 11,
        fontWeight: "800",
    },
    managedGlass: {
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    managedSpecular: {
        position: "absolute",
        top: 0,
        left: SP12,
        right: SP12,
        height: 0.5,
        backgroundColor: SPEC_TOP,
    },
    managedRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SP12,
        paddingHorizontal: SP16,
        paddingVertical: SP16,
    },
    managedIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: "rgba(191,90,242,0.10)",
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
    },
    managedText: {
        flex: 1,
        color: palette.inkMuted,
        fontSize: 14,
        fontWeight: "500",
        lineHeight: 20,
    },
    managedDivider: {
        height: 0.5,
        marginHorizontal: SP16,
        backgroundColor: "rgba(255,255,255,0.06)",
    },
    addFolderBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SP8,
        marginTop: SP16,
        paddingVertical: SP12,
    },
    addFolderBtnText: {
        color: palette.primary,
        fontSize: 15,
        fontWeight: "700",
    },

    // ── State screens (loading / empty)
    stateCenter: {
        alignItems: "center",
        paddingHorizontal: PAD,
        paddingTop: 72,
        gap: SP12,
    },
    loaderGlass: {
        width: 84,
        height: 84,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: SP16,
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: BORDER_SUBTLE,
    },
    stateContainer: {
        paddingHorizontal: PAD,
        marginTop: SP24,
    },
    stateGlass: {
        padding: SP32,
        alignItems: "center",
        overflow: "hidden",
        borderWidth: 0.5,
        borderColor: "rgba(255,255,255,0.09)",
    },
    stateSpecular: {
        position: "absolute",
        top: 0,
        left: SP24,
        right: SP24,
        height: 1,
        backgroundColor: SPEC_TOP,
    },
    stateIconWrap: {
        marginBottom: SP24,
    },
    stateIconBg: {
        width: 80,
        height: 80,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    stateTitle: {
        color: palette.ink,
        fontSize: isTablet ? 22 : 20,
        fontWeight: "900",
        letterSpacing: -0.5,
        textAlign: "center",
        marginBottom: SP8,
        lineHeight: isTablet ? 28 : 26,
    },
    stateSub: {
        color: palette.inkMuted,
        fontSize: 14,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: SP32,
        paddingHorizontal: SP8,
        opacity: 0.9,
    },

    // Primary CTA button
    primaryBtn: {
        height: 52,
        borderRadius: 26,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: SP8,
        width: "100%",
        // Shadow
        shadowColor: palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.30,
        shadowRadius: 14,
        elevation: 10,
    },
    primaryBtnSpec: {
        position: "absolute",
        top: 0,
        left: SP24,
        right: SP24,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.28)",
        zIndex: 1,
    },
    primaryBtnTxt: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.2,
    },

    // Ghost / secondary button
    ghostBtn: {
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 0.5,
        borderColor: "rgba(255,255,255,0.12)",
        justifyContent: "center",
        alignItems: "center",
    },
    ghostBtnTxt: {
        color: palette.ink,
        fontSize: 15,
        fontWeight: "700",
    },

    dualBtnRow: {
        flexDirection: "row",
        gap: SP12,
        width: "100%",
    },

    // ── Onboarding Modal
    onboardingOverlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: PAD,
    },
    onboardingBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.72)",
    },
    onboardingContent: {
        width: "100%",
        maxWidth: 360,
    },
    onboardingGlass: {
        paddingHorizontal: SP24,
        paddingTop: SP32,
        paddingBottom: SP24,
        alignItems: "center",
        overflow: "hidden",
    },
    onboardingSpecular: {
        position: "absolute",
        top: 0,
        left: SP24,
        right: SP24,
        height: 1,
        backgroundColor: SPEC_TOP,
    },
    onboardingIconWrap: {
        marginBottom: SP24,
    },
    onboardingIconBg: {
        width: 84,
        height: 84,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    onboardingTitle: {
        color: palette.ink,
        fontSize: isTablet ? 22 : 20,
        fontWeight: "900",
        letterSpacing: -0.5,
        textAlign: "center",
        marginBottom: SP12,
        lineHeight: isTablet ? 28 : 26,
    },
    onboardingSub: {
        color: palette.inkMuted,
        fontSize: 14,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: SP12,
        paddingHorizontal: SP4,
    },
    onboardingNote: {
        color: "rgba(170,170,185,0.40)",
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
        marginBottom: SP24,
        paddingHorizontal: SP8,
    },
    onboardingActions: {
        width: "100%",
        gap: SP12,
    },
    onboardingPrimaryBtn: {
        height: 52,
        borderRadius: 26,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "row",
        gap: SP8,
        width: "100%",
        shadowColor: palette.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.30,
        shadowRadius: 14,
        elevation: 10,
    },
    onboardingBtnSpec: {
        position: "absolute",
        top: 0,
        left: SP24,
        right: SP24,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.28)",
        zIndex: 1,
    },
    onboardingPrimaryBtnText: {
        color: "#fff",
        fontSize: 15,
        fontWeight: "800",
        letterSpacing: 0.2,
    },
    onboardingSecondaryBtn: {
        height: 52,
        borderRadius: 26,
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    onboardingSecondaryBtnText: {
        color: palette.inkMuted,
        fontSize: 14,
        fontWeight: "600",
    },

    // ── Permission Denied Modal
    deniedIconWrap: {
        marginBottom: SP20,
    },
});
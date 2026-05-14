import React, { useCallback, useEffect, useState, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    View,
    StatusBar,
    ActivityIndicator,
    Platform,
} from "react-native";
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming,
    Easing 
} from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { usePlayerStore } from "@/src/features/player/store/player.store";
import { LocalMusicService } from "@/src/services/local-music.service";
import { MusicTrack } from "@/src/types/music";
import { PlayerTrack } from "@/src/features/player/types/player";
import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import { PressScale } from "@/src/components/ui/press-scale";
import { palette, radius, spacing } from "@/src/design/tokens";

const { width: SW } = Dimensions.get("window");

const isTablet = SW >= 768;
const PAD = isTablet ? spacing.xl : 20;

const LocalTrackRow = React.memo(
    ({
        track,
        onPlay,
        isActive,
    }: {
        track: MusicTrack;
        onPlay: (track: MusicTrack) => void;
        isActive?: boolean;
    }) => {
        return (
            <PressScale
                onPress={() => onPlay(track)}
                haptic={Haptics.ImpactFeedbackStyle.Light}
                style={[
                    s.trackRow,
                    isActive && s.activeTrackRow,
                ]}
            >
                <LiquidGlass
                    borderRadius={26}
                    intensity={18}
                    style={s.trackGlass}
                >
                    <View style={s.trackInner}>
                        <View style={s.trackArtContainer}>
                            {track.art ? (
                                <Image
                                    source={{ uri: track.art }}
                                    style={s.trackArt}
                                    contentFit="cover"
                                    transition={200}
                                />
                            ) : (
                                <View style={s.trackFallback}>
                                    <Ionicons
                                        name="musical-note"
                                        size={20}
                                        color={isActive ? palette.primary : "rgba(255,255,255,0.25)"}
                                    />
                                </View>
                            )}

                            {isActive && (
                                <View style={s.activeBadge}>
                                    <Ionicons
                                        name="volume-medium"
                                        size={12}
                                        color={palette.primary}
                                    />
                                </View>
                            )}
                        </View>

                        <View style={s.trackInfo}>
                            <Text
                                style={[
                                    s.trackTitle,
                                    isActive && { color: palette.primary },
                                ]}
                                numberOfLines={1}
                            >
                                {track.title}
                            </Text>

                            <View style={s.metaRow}>
                                <Text style={s.trackArtist} numberOfLines={1}>
                                    {track.artist || "Local Audio"}
                                </Text>

                                {track.mimeType && (
                                    <View style={s.mimeBadge}>
                                        <Text style={s.mimeText}>
                                            {track.mimeType.split("/")[1]?.toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={s.rightMeta}>
                            <Text style={s.trackDur}>{track.time || "--:--"}</Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="rgba(255,255,255,0.2)"
                            />
                        </View>
                    </View>
                </LiquidGlass>
            </PressScale>
        );
    }
);

const FolderCard = React.memo(
    ({
        name,
        count,
        onPress,
    }: {
        name: string;
        count: number;
        onPress: () => void;
    }) => {
        return (
            <PressScale
                style={s.folderCard}
                onPress={onPress}
                haptic={Haptics.ImpactFeedbackStyle.Medium}
            >
                <LiquidGlass
                    borderRadius={32}
                    intensity={20}
                    style={s.folderGlass}
                >
                    <LinearGradient
                        colors={[
                            "rgba(191,90,242,0.16)",
                            "rgba(255,255,255,0.01)",
                        ]}
                        style={StyleSheet.absoluteFill}
                    />

                    <View style={s.folderTop}>
                        <View style={s.folderBadge}>
                            <Text style={s.folderBadgeText}>{count}</Text>
                        </View>
                    </View>

                    <View style={s.folderCenter}>
                        <View style={s.folderIconWrap}>
                            <Ionicons
                                name="folder-open"
                                size={32}
                                color={palette.primary}
                            />
                        </View>
                    </View>

                    <View style={s.folderBottom}>
                        <Text style={s.folderName} numberOfLines={2}>
                            {name}
                        </Text>
                        <Text style={s.folderSub}>Local Collection</Text>
                    </View>
                </LiquidGlass>
            </PressScale>
        );
    }
);

export default function LocalLibraryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { setQueue, currentTrack } = usePlayerStore();

    const [activeTab, setActiveTab] = useState("Songs");
    const [isLoading, setIsLoading] = useState(true);
    const rotation = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [folders, setFolders] = useState<Record<string, MusicTrack[]>>({});
    const [grantedFolders, setGrantedFolders] = useState<string[]>([]);

    const loadLocalMedia = useCallback(async () => {
        setIsLoading(true);
        rotation.value = withTiming(rotation.value + 360, {
            duration: 800,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
        });

        try {
            const folderUris = await LocalMusicService.getPersistedFolderUris();
            setGrantedFolders(folderUris);
            
            if (folderUris.length > 0) {
                const localTracks = await LocalMusicService.getLocalTracks();
                setTracks(localTracks);
                setFolders(LocalMusicService.groupByFolder(localTracks));
            } else {
                setTracks([]);
                setFolders({});
            }
        } catch (e) {
            console.warn("Local media load failed", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLocalMedia();
    }, [loadLocalMedia]);

    const handleGrantAccess = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const uri = await LocalMusicService.grantFolderPermission();
            if (uri) {
                loadLocalMedia();
            } else if (Platform.OS === 'android') {
                // If on Android but no URI, it means either user cancelled or SAF is missing
                console.log('[LocalLibrary] Folder access not granted or cancelled.');
            }
        } catch (e) {
            console.error('[LocalLibrary] Grant access failed:', e);
        }
    };

    const handleRemoveFolder = async (uri: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await LocalMusicService.removeFolderUri(uri);
        loadLocalMedia();
    };

    const handlePlayTrack = useCallback(
        (track: MusicTrack, list: MusicTrack[] = tracks) => {
            const playerTracks: PlayerTrack[] = list.map((t) => ({
                id: t.id,
                title: t.title,
                artist: t.artist || "Local",
                art: t.art || "",
                url: t.url || t.localUri || "", 
                isLocal: true,
                duration: 0,
            }));

            const startIndex = playerTracks.findIndex((t) => t.id === track.id);

            setQueue(playerTracks, startIndex !== -1 ? startIndex : 0);

            router.push({
                pathname: "/now_playing",
                params: { trackId: track.id },
            });
        },
        [setQueue, router, tracks]
    );

    const sortedFolders = useMemo(() => {
        return Object.entries(folders).sort((a, b) => b[1].length - a[1].length);
    }, [folders]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={s.center}>
                    <LiquidGlass borderRadius={36} style={s.loaderGlass} intensity={20}>
                        <ActivityIndicator size="large" color={palette.primary} />
                    </LiquidGlass>

                    <Text style={s.loadingTitle}>Gathering your music</Text>
                    <Text style={s.loadingText}>
                        Scanning local files and building your library.
                    </Text>
                </View>
            );
        }

        if (grantedFolders.length === 0) {
            return (
                <View style={s.emptyState}>
                    <LiquidGlass borderRadius={40} style={s.emptyGlass} intensity={22}>
                        <LinearGradient
                            colors={[
                                "rgba(191,90,242,0.12)",
                                "rgba(255,255,255,0.02)",
                            ]}
                            style={StyleSheet.absoluteFill}
                        />

                        <View style={s.emptyIconWrap}>
                            <Ionicons
                                name="folder-outline"
                                size={46}
                                color={palette.primary}
                            />
                        </View>

                        <Text style={s.emptyText}>Access required</Text>
                        <Text style={s.emptySub}>
                            Grant access to your music folders to start playing offline tracks.
                        </Text>

                        <PressScale
                            style={s.refreshBtn}
                            onPress={handleGrantAccess}
                            haptic={Haptics.ImpactFeedbackStyle.Medium}
                        >
                            <LinearGradient
                                colors={[palette.primary, "#7B42F6"]}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={s.refreshBtnTxt}>Grant Music Folder Access</Text>
                        </PressScale>
                    </LiquidGlass>
                </View>
            );
        }

        if (tracks.length === 0) {
            return (
                <View style={s.emptyState}>
                    <LiquidGlass borderRadius={40} style={s.emptyGlass} intensity={22}>
                        <LinearGradient
                            colors={[
                                "rgba(191,90,242,0.12)",
                                "rgba(255,255,255,0.02)",
                            ]}
                            style={StyleSheet.absoluteFill}
                        />

                        <View style={s.emptyIconWrap}>
                            <Ionicons
                                name="musical-notes-outline"
                                size={46}
                                color={palette.primary}
                            />
                        </View>

                        <Text style={s.emptyText}>No music found</Text>
                        <Text style={s.emptySub}>
                            We couldn't find any supported audio files in the granted folders.
                        </Text>
                        
                        <View style={s.folderActionRow}>
                            <PressScale
                                style={[s.actionBtn, { flex: 1 }]}
                                onPress={handleGrantAccess}
                                haptic={Haptics.ImpactFeedbackStyle.Medium}
                            >
                                <Text style={s.actionBtnTxt}>Add Folder</Text>
                            </PressScale>
                            <PressScale
                                style={[s.actionBtn, { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                                onPress={loadLocalMedia}
                                haptic={Haptics.ImpactFeedbackStyle.Medium}
                            >
                                <Text style={s.actionBtnTxt}>Scan Again</Text>
                            </PressScale>
                        </View>
                    </LiquidGlass>
                </View>
            );
        }

        if (activeTab === "Songs") {
            return (
                <View style={s.songsList}>
                    {tracks.map((t) => (
                        <LocalTrackRow
                            key={t.id}
                            track={t}
                            onPlay={(track) => handlePlayTrack(track, tracks)}
                            isActive={currentTrack?.id === t.id}
                        />
                    ))}
                    
                    <PressScale 
                        style={s.addMoreRow} 
                        onPress={handleGrantAccess}
                        haptic={Haptics.ImpactFeedbackStyle.Medium}
                    >
                        <Ionicons name="add-circle-outline" size={24} color={palette.primary} />
                        <Text style={s.addMoreText}>Add more folders to scan</Text>
                    </PressScale>
                </View>
            );
        }

        if (activeTab === "Folders") {
            return (
                <View style={s.folderContainer}>
                    <View style={s.folderGrid}>
                        {sortedFolders.map(([name, folderTracks]) => (
                            <FolderCard
                                key={name}
                                name={name}
                                count={folderTracks.length}
                                onPress={() => handlePlayTrack(folderTracks[0], folderTracks)}
                            />
                        ))}
                    </View>
                    
                    <View style={s.manageFoldersSection}>
                         <Text style={s.manageTitle}>Managed Folders</Text>
                         {grantedFolders.map((uri) => (
                             <View key={uri} style={s.managedFolderRow}>
                                 <View style={s.managedInfo}>
                                     <Ionicons name="folder" size={20} color={palette.primary} />
                                     <Text style={s.managedText} numberOfLines={1}>
                                         {decodeURIComponent(uri).split('/').pop()}
                                     </Text>
                                 </View>
                                 <PressScale onPress={() => handleRemoveFolder(uri)}>
                                     <Ionicons name="close-circle" size={22} color={palette.coral} />
                                 </PressScale>
                             </View>
                         ))}
                         <PressScale style={s.addFolderFooter} onPress={handleGrantAccess}>
                             <Ionicons name="add" size={20} color={palette.primary} />
                             <Text style={s.addFolderFooterText}>Add Folder</Text>
                         </PressScale>
                    </View>
                </View>
            );
        }

        return null;
    };

    return (
        <View style={s.root}>
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <LinearGradient
                    colors={[
                        "#131318",
                        "#131318",
                        "#0f0f13",
                    ]}
                    style={StyleSheet.absoluteFill}
                />

                <LinearGradient
                    colors={[
                        "rgba(191,90,242,0.18)",
                        "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.bgGlowOne}
                />

                <LinearGradient
                    colors={[
                        "rgba(70,245,224,0.10)",
                        "transparent",
                    ]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={s.bgGlowTwo}
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingBottom: 180,
                }}
            >
                <View
                    style={[
                        s.header,
                        {
                            paddingTop: insets.top + 12,
                        },
                    ]}
                >
                    <PressScale
                        style={s.headerBtn}
                        onPress={() => router.back()}
                        haptic={Haptics.ImpactFeedbackStyle.Light}
                    >
                        <LiquidGlass borderRadius={22} style={s.btnGlass} intensity={16}>
                            <Ionicons
                                name="chevron-back"
                                size={22}
                                color={palette.ink}
                            />
                        </LiquidGlass>
                    </PressScale>

                    <View style={s.headerInfo}>
                        <Text style={s.headerEyebrow}>Your Device Music</Text>
                        <Text style={s.headerTitle}>Local Library</Text>

                        <View style={s.statRow}>
                            <View style={s.dot} />
                            <Text style={s.headerSub}>
                                {tracks.length} songs discovered
                            </Text>
                        </View>
                    </View>

                    <PressScale
                        style={s.headerBtn}
                        onPress={loadLocalMedia}
                        disabled={isLoading}
                        haptic={Haptics.ImpactFeedbackStyle.Light}
                    >
                        <LiquidGlass borderRadius={22} style={s.btnGlass} intensity={16}>
                            {isLoading ? (
                                <ActivityIndicator size="small" color={palette.primary} />
                            ) : (
                                <Animated.View style={animatedStyle}>
                                    <Ionicons
                                        name="reload"
                                        size={20}
                                        color={palette.primary}
                                    />
                                </Animated.View>
                            )}
                        </LiquidGlass>
                    </PressScale>
                </View>

                <View style={s.heroSection}>
                    <LiquidGlass borderRadius={40} intensity={22} style={s.heroGlass}>
                        <LinearGradient
                            colors={[
                                "rgba(191,90,242,0.18)",
                                "rgba(255,255,255,0.02)",
                            ]}
                            style={StyleSheet.absoluteFill}
                        />

                        <View style={s.heroTop}>
                            <View>
                                <Text style={s.heroTitle}>Your offline universe</Text>
                                <Text style={s.heroSub}>
                                    Rediscover local tracks with immersive playback.
                                </Text>
                            </View>
                        </View>

                        <View style={s.heroStatsRow}>
                            <View style={s.heroStatCard}>
                                <Text style={s.heroStatNumber}>{tracks.length}</Text>
                                <Text style={s.heroStatLabel}>Tracks</Text>
                            </View>

                            <View style={s.heroStatCard}>
                                <Text style={s.heroStatNumber}>{sortedFolders.length}</Text>
                                <Text style={s.heroStatLabel}>Folders</Text>
                            </View>
                        </View>
                    </LiquidGlass>
                </View>

                <View style={s.tabsContainer}>
                    <LiquidGlass borderRadius={28} style={s.tabsGlass} intensity={14}>
                        <View style={s.tabsInner}>
                            {["Songs", "Folders"].map((tab) => {
                                const active = activeTab === tab;

                                return (
                                    <PressScale
                                        key={tab}
                                        style={[
                                            s.tabBtn,
                                            active && s.tabBtnActive,
                                        ]}
                                        onPress={() => setActiveTab(tab)}
                                        haptic={Haptics.ImpactFeedbackStyle.Light}
                                    >
                                        {active && (
                                            <LinearGradient
                                                colors={[
                                                    "rgba(218,185,255,0.9)",
                                                    "rgba(123,66,246,0.9)",
                                                ]}
                                                style={StyleSheet.absoluteFill}
                                            />
                                        )}

                                        <Text
                                            style={[
                                                s.tabTxt,
                                                active && s.tabTxtActive,
                                            ]}
                                        >
                                            {tab}
                                        </Text>
                                    </PressScale>
                                );
                            })}
                        </View>
                    </LiquidGlass>
                </View>

                {renderContent()}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: palette.background,
    },

    bgGlowOne: {
        position: "absolute",
        width: 320,
        height: 320,
        borderRadius: 160,
        top: -80,
        left: -100,
    },

    bgGlowTwo: {
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: 130,
        top: 120,
        right: -80,
    },

    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: PAD,
        marginBottom: 24,
    },

    headerBtn: {
        width: 44,
        height: 44,
    },

    btnGlass: {
        width: 44,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
    },

    headerInfo: {
        flex: 1,
        marginHorizontal: 16,
    },

    headerEyebrow: {
        fontSize: 12,
        color: palette.primary,
        fontWeight: "700",
        marginBottom: 4,
        letterSpacing: 0.4,
    },

    headerTitle: {
        fontSize: 32,
        fontWeight: "900",
        color: palette.ink,
        letterSpacing: -1.4,
    },

    statRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
    },

    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: palette.primary,
        marginRight: 8,
    },

    headerSub: {
        fontSize: 13,
        color: palette.inkMuted,
        fontWeight: "600",
        opacity: 0.8,
    },

    heroSection: {
        paddingHorizontal: PAD,
        marginBottom: 28,
    },

    heroGlass: {
        padding: 24,
        overflow: "hidden",
    },

    heroTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 24,
    },

    heroTitle: {
        color: palette.ink,
        fontSize: 28,
        fontWeight: "900",
        letterSpacing: -1,
    },

    heroSub: {
        color: palette.inkMuted,
        fontSize: 14,
        lineHeight: 22,
        marginTop: 6,
        maxWidth: "88%",
    },

    heroIconWrap: {
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.06)",
    },

    heroStatsRow: {
        flexDirection: "row",
        gap: 12,
    },

    heroStatCard: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderRadius: 24,
        paddingVertical: 18,
        paddingHorizontal: 18,
    },

    heroStatNumber: {
        color: palette.ink,
        fontSize: 24,
        fontWeight: "900",
        marginBottom: 6,
    },

    heroStatLabel: {
        color: palette.inkMuted,
        fontSize: 13,
        fontWeight: "600",
    },

    tabsContainer: {
        paddingHorizontal: PAD,
        marginBottom: 24,
    },

    tabsGlass: {
        height: 58,
        padding: 5,
    },

    tabsInner: {
        flex: 1,
        flexDirection: "row",
        gap: 6,
    },

    tabBtn: {
        flex: 1,
        borderRadius: 24,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },

    tabBtnActive: {
        shadowColor: "#7B42F6",
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 12,
    },

    tabTxt: {
        fontSize: 15,
        fontWeight: "700",
        color: palette.inkMuted,
    },

    tabTxtActive: {
        color: "#FFF",
    },

    songsList: {
        paddingHorizontal: PAD,
        gap: 12,
    },

    trackRow: {
        borderRadius: 28,
    },

    activeTrackRow: {
        transform: [{ scale: 1.01 }],
    },

    trackGlass: {
        overflow: "hidden",
    },

    trackInner: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 14,
    },

    trackArtContainer: {
        position: "relative",
        marginRight: 16,
    },

    trackArt: {
        width: 58,
        height: 58,
        borderRadius: 18,
    },

    trackFallback: {
        width: 58,
        height: 58,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.04)",
        justifyContent: "center",
        alignItems: "center",
    },

    activeBadge: {
        position: "absolute",
        right: -4,
        bottom: -4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "rgba(19,19,24,0.92)",
        justifyContent: "center",
        alignItems: "center",
    },

    trackInfo: {
        flex: 1,
    },

    trackTitle: {
        fontSize: 16,
        color: palette.ink,
        fontWeight: "800",
        marginBottom: 6,
        letterSpacing: -0.2,
    },

    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    trackArtist: {
        fontSize: 13,
        color: palette.inkMuted,
        fontWeight: "600",
    },

    mimeBadge: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },

    mimeText: {
        color: palette.primary,
        fontSize: 9,
        fontWeight: "900",
        letterSpacing: 0.5,
    },

    rightMeta: {
        alignItems: "flex-end",
        gap: 8,
    },

    trackDur: {
        fontSize: 12,
        color: "rgba(255,255,255,0.32)",
        fontWeight: "700",
    },

    folderGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingHorizontal: PAD,
        gap: 16,
    },

    folderCard: {
        width: (SW - PAD * 2 - 16) / 2,
    },

    folderGlass: {
        aspectRatio: 0.95,
        padding: 18,
        justifyContent: "space-between",
    },

    folderTop: {
        flexDirection: "row",
        justifyContent: "flex-end",
    },

    folderBadge: {
        backgroundColor: "rgba(218,185,255,0.16)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
    },

    folderBadgeText: {
        color: palette.primary,
        fontSize: 11,
        fontWeight: "800",
    },

    folderCenter: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
    },

    folderIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "rgba(255,255,255,0.04)",
        justifyContent: "center",
        alignItems: "center",
    },

    folderBottom: {},

    folderName: {
        color: palette.ink,
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 4,
        letterSpacing: -0.2,
    },

    folderSub: {
        color: palette.inkMuted,
        fontSize: 12,
        fontWeight: "600",
    },

    center: {
        justifyContent: "center",
        alignItems: "center",
        marginTop: 120,
        paddingHorizontal: 40,
    },

    loaderGlass: {
        width: 92,
        height: 92,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },

    loadingTitle: {
        color: palette.ink,
        fontSize: 20,
        fontWeight: "800",
        marginBottom: 8,
    },

    loadingText: {
        color: palette.inkMuted,
        fontSize: 14,
        textAlign: "center",
        lineHeight: 22,
    },

    emptyState: {
        paddingHorizontal: PAD,
        marginTop: 40,
    },

    emptyGlass: {
        padding: 28,
        alignItems: "center",
    },

    emptyIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "rgba(255,255,255,0.04)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 24,
    },

    emptyText: {
        color: palette.ink,
        fontSize: 24,
        fontWeight: "900",
        marginBottom: 10,
        letterSpacing: -0.6,
    },

    emptySub: {
        color: palette.inkMuted,
        fontSize: 14,
        lineHeight: 22,
        textAlign: "center",
        marginBottom: 30,
        opacity: 0.8,
    },

    refreshBtn: {
        width: "100%",
        height: 58,
        borderRadius: 29,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },

    refreshBtnTxt: {
        color: "white",
        fontSize: 15,
        fontWeight: "900",
        letterSpacing: 0.3,
    },

    folderActionRow: {
        flexDirection: "row",
        gap: 12,
        width: "100%",
    },

    actionBtn: {
        height: 50,
        borderRadius: 20,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },

    actionBtnTxt: {
        color: palette.ink,
        fontSize: 14,
        fontWeight: "700",
    },

    addMoreRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingVertical: 20,
        opacity: 0.6,
    },

    addMoreText: {
        color: palette.primary,
        fontSize: 15,
        fontWeight: "600",
    },

    folderContainer: {
        paddingBottom: 40,
    },

    manageFoldersSection: {
        marginTop: 40,
        paddingHorizontal: PAD,
    },

    manageTitle: {
        color: palette.ink,
        fontSize: 18,
        fontWeight: "800",
        marginBottom: 16,
    },

    managedFolderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255,255,255,0.04)",
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
    },

    managedInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },

    managedText: {
        color: palette.inkMuted,
        fontSize: 14,
        fontWeight: "500",
    },

    addFolderFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 12,
        paddingVertical: 10,
    },

    addFolderFooterText: {
        color: palette.primary,
        fontSize: 14,
        fontWeight: "700",
    },
});
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import { DownloadQueueItem } from "@/src/features/download/types/download";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiquidGlass } from "@/src/components/ui/liquid-glass";
import * as Haptics from "expo-haptics";

const { width: SW } = Dimensions.get("window");
const isTablet = SW >= 768;
const PAD = isTablet ? 28 : 20;

// Colors matching downloads screen C palette
const C = {
  primary: "#BF5AF2",
  primaryMid: "#9B38DA",
  primaryDp: "#7B2FBE",
  accent: "#46f5e0",
  bg: "#08080D",
  surface: "rgba(255,255,255,0.055)",
  border: "rgba(255,255,255,0.10)",
  text: "#FFFFFF",
  muted: "rgba(170,170,185,0.65)",
  dim: "rgba(170,170,185,0.40)",
  danger: "#FF453A",
};

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "";
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s left`;
  }
  return `${Math.round(seconds)}s left`;
}

// Ambient Background with pulse animations
const AmbientBG = React.memo(() => {
  const orb1 = useRef(new Animated.Value(0)).current;
  const orb2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (val: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, {
            toValue: 1,
            duration: dur,
            delay,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: dur,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    pulse(orb1, 6000, 0);
    pulse(orb2, 8000, 2000);
  }, []);

  const scale1 = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });
  const scale2 = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const op1 = orb1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.12],
  });
  const op2 = orb2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.09],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: C.bg }} />
      <LinearGradient
        colors={["rgba(191,90,242,0.04)", "transparent"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            top: -100,
            right: -60,
            backgroundColor: C.primary,
            opacity: op1,
            transform: [{ scale: scale1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          {
            bottom: 100,
            left: -80,
            backgroundColor: C.accent,
            opacity: op2,
            transform: [{ scale: scale2 }],
          },
        ]}
      />
    </View>
  );
});

// Section Header with Collapse state and smooth rotation arrow
interface SectionHeaderProps {
  title: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const SectionHeader = React.memo(({ title, count, isCollapsed, onToggle }: SectionHeaderProps) => {
  const rotation = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: isCollapsed ? 0 : 1,
      duration: 250,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: true,
    }).start();
  }, [isCollapsed]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  if (count === 0) return null;

  return (
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
        <Ionicons name="chevron-forward" size={16} color={C.muted} />
      </Animated.View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
});

// Individual track rows memoized
interface RowProps {
  item: DownloadQueueItem;
}

const DownloadingRow = React.memo(({ item }: RowProps) => {
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);

  const speedStr = formatSpeed(item.speedBytesPerSecond);
  const etaStr = formatEta(item.estimatedTimeRemaining);
  const isPaused = item.status === "paused";

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelDownload(item.trackId);
  }, [item.trackId, cancelDownload]);

  const handleTogglePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPaused) {
      resumeDownload(item.trackId);
    } else {
      pauseDownload(item.trackId);
    }
  }, [item.trackId, isPaused, pauseDownload, resumeDownload]);

  return (
    <View style={styles.row}>
      <AuraArtwork
        source={resolveArtwork({ art: item.artwork, title: item.title }, 'card')}
        entityName={item.title}
        entityType="song"
        style={styles.artwork}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        borderRadius={10}
      />
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${item.progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {item.status === "preparing"
              ? "Preparing..."
              : item.status === "verifying"
              ? "Verifying..."
              : isPaused
              ? "Paused"
              : `${item.progress}%`}
            {speedStr && !isPaused && ` · ${speedStr}`}
            {etaStr && !isPaused && ` · ${etaStr}`}
          </Text>
        </View>
      </View>
      <View style={styles.actionsCol}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleTogglePlay}>
          <Ionicons
            name={isPaused ? "play-outline" : "pause-outline"}
            size={18}
            color={C.text}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
          <Ionicons name="close-outline" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface QueuedRowProps extends RowProps {
  position: number;
}

const QueuedRow = React.memo(({ item, position }: QueuedRowProps) => {
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelDownload(item.trackId);
  }, [item.trackId, cancelDownload]);

  return (
    <View style={styles.row}>
      <AuraArtwork
        source={resolveArtwork({ art: item.artwork, title: item.title }, 'card')}
        entityName={item.title}
        entityType="song"
        style={styles.artwork}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        borderRadius={10}
      />
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={styles.subtitle}>Queue position: #{position}</Text>
      </View>
      <View style={styles.actionsCol}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCancel}>
          <Ionicons name="close-outline" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const CompletedRow = React.memo(({ item }: RowProps) => {
  return (
    <View style={styles.row}>
      <AuraArtwork
        source={resolveArtwork({ art: item.artwork, title: item.title }, 'card')}
        entityName={item.title}
        entityType="song"
        style={styles.artwork}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        borderRadius={10}
      />
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={[styles.subtitle, { color: "#30D158" }]}>Completed</Text>
      </View>
      <View style={styles.actionsCol}>
        <View style={styles.statusBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#30D158" />
        </View>
      </View>
    </View>
  );
});

const FailedRow = React.memo(({ item }: RowProps) => {
  const retryDownload = useDownloadStore((s) => s.retryDownload);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    retryDownload(item.trackId);
  }, [item.trackId, retryDownload]);

  const handleDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cancelDownload(item.trackId);
  }, [item.trackId, cancelDownload]);

  return (
    <View style={styles.row}>
      <AuraArtwork
        source={resolveArtwork({ art: item.artwork, title: item.title }, 'card')}
        entityName={item.title}
        entityType="song"
        style={styles.artwork}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        borderRadius={10}
      />
      <View style={styles.infoCol}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={[styles.subtitle, { color: C.danger }]} numberOfLines={1}>
          Error: {item.error || "Download failed"}
        </Text>
      </View>
      <View style={styles.actionsCol}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRetry}>
          <Ionicons name="refresh-outline" size={18} color={C.accent} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={C.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// MAIN DETAILED QUEUE SCREEN
export default function DownloadQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const queue = useDownloadStore((s) => s.queue);
  const isQueuePaused = useDownloadStore((s) => s.isQueuePaused);
  const pauseQueue = useDownloadStore((s) => s.pauseQueue);
  const resumeQueue = useDownloadStore((s) => s.resumeQueue);
  const clearCompleted = useDownloadStore((s) => s.clearCompleted);
  const clearFailed = useDownloadStore((s) => s.clearFailed);

  // Split queue categories
  const downloading = useMemo(
    () => queue.filter((item) => ["downloading", "preparing", "verifying", "paused"].includes(item.status)),
    [queue]
  );
  const queued = useMemo(
    () => queue.filter((item) => item.status === "queued"),
    [queue]
  );
  const completed = useMemo(
    () => queue.filter((item) => item.status === "completed"),
    [queue]
  );
  const failed = useMemo(
    () => queue.filter((item) => item.status === "failed"),
    [queue]
  );

  // Collapse status
  const [downloadingCollapsed, setDownloadingCollapsed] = useState(false);
  const [queuedCollapsed, setQueuedCollapsed] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [failedCollapsed, setFailedCollapsed] = useState(false);

  // Header height logic
  const headerPaddingTop = insets.top + 12;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AmbientBG />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <View style={[styles.headerContainer, { paddingTop: headerPaddingTop }]}>
          {/* Back Button and Screen Title */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={C.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Download Queue</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Main Controls Card */}
          <LiquidGlass style={styles.controlsCard} borderRadius={24} intensity={40}>
            <View style={styles.controlsCardInner}>
              <View style={styles.controlsLeft}>
                <Text style={styles.controlsLabel}>Queue Status</Text>
                <Text style={styles.controlsStatus}>
                  {isQueuePaused ? "Paused" : downloading.length > 0 ? "Downloading" : "Idle"}
                </Text>
              </View>

              <View style={styles.controlsRight}>
                <TouchableOpacity
                  style={styles.mainControlBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (isQueuePaused) {
                      resumeQueue();
                    } else {
                      pauseQueue();
                    }
                  }}
                >
                  <Ionicons
                    name={isQueuePaused ? "play" : "pause"}
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.mainControlBtnText}>
                    {isQueuePaused ? "Resume" : "Pause"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  clearCompleted();
                }}
              >
                <Ionicons name="checkmark-done-outline" size={16} color={C.muted} />
                <Text style={styles.quickActionBtnText}>Clear Completed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  clearFailed();
                }}
              >
                <Ionicons name="trash-outline" size={16} color={C.danger} />
                <Text style={[styles.quickActionBtnText, { color: C.danger }]}>Clear Failed</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlass>
        </View>

        {/* Dynamic Lists */}
        <View style={styles.listContainer}>
          {/* Downloading Section */}
          <SectionHeader
            title="Downloading"
            count={downloading.length}
            isCollapsed={downloadingCollapsed}
            onToggle={() => setDownloadingCollapsed(!downloadingCollapsed)}
          />
          {!downloadingCollapsed &&
            downloading.map((item, idx) => <DownloadingRow key={`dl-${item.trackId}-${idx}`} item={item} />)}

          {/* Queued Section */}
          <SectionHeader
            title="Queued"
            count={queued.length}
            isCollapsed={queuedCollapsed}
            onToggle={() => setQueuedCollapsed(!queuedCollapsed)}
          />
          {!queuedCollapsed &&
            queued.map((item, idx) => (
              <QueuedRow key={`queued-${item.trackId}-${idx}`} item={item} position={idx + 1} />
            ))}

          {/* Completed Section */}
          <SectionHeader
            title="Completed"
            count={completed.length}
            isCollapsed={completedCollapsed}
            onToggle={() => setCompletedCollapsed(!completedCollapsed)}
          />
          {!completedCollapsed &&
            completed.map((item, idx) => <CompletedRow key={`completed-${item.trackId}-${idx}`} item={item} />)}

          {/* Failed Section */}
          <SectionHeader
            title="Failed"
            count={failed.length}
            isCollapsed={failedCollapsed}
            onToggle={() => setFailedCollapsed(!failedCollapsed)}
          />
          {!failedCollapsed &&
            failed.map((item, idx) => <FailedRow key={`failed-${item.trackId}-${idx}`} item={item} />)}

          {queue.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="musical-notes-outline" size={32} color={C.muted} />
              </View>
              <Text style={styles.emptyText}>Download queue is empty</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  orb: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  headerContainer: {
    paddingHorizontal: PAD,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  headerTitle: {
    fontSize: isTablet ? 32 : 26,
    fontWeight: "900",
    color: C.text,
    letterSpacing: -0.6,
  },
  controlsCard: {
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  controlsCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  controlsLeft: {
    flexDirection: "column",
  },
  controlsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  controlsStatus: {
    fontSize: 20,
    fontWeight: "900",
    color: C.text,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  controlsRight: {
    flexDirection: "row",
  },
  mainControlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
  },
  mainControlBtnText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.muted,
  },
  listContainer: {
    marginTop: 18,
    paddingHorizontal: PAD,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
  },
  sectionBadge: {
    backgroundColor: "rgba(191,90,242,0.15)",
    borderWidth: 1,
    borderColor: "rgba(191,90,242,0.25)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    color: C.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255,255,255,0.04)",
    minHeight: 70,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    letterSpacing: -0.1,
  },
  artist: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: C.dim,
    marginTop: 3,
  },
  progressContainer: {
    marginTop: 6,
    flexDirection: "column",
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: C.accent,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  actionsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionBtn: {
    padding: 6,
  },
  statusBadge: {
    padding: 6,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: C.muted,
  },
});

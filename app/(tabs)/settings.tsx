import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";
import { useSettingsStore, AudioQuality } from "../../src/features/settings/store/settings.store";
import { useDeviceStateStore } from "../../src/features/device/store/device-state.store";
import { CacheManager, StorageStats } from "../../src/features/cache/services/cache-manager.service";
import { useDownloadStore } from "../../src/features/download/store/download.store";
import { AudioSessionController } from "../../src/features/audio/native/audio-session";
import { downloadCleanupService } from "../../src/features/download/services/download-cleanup.service";
import {
  colors as baseColors,
  spacing,
  typography
} from "../../src/styles/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SettingSection = ({
  title,
  children,
  index,
}: {
  title: string;
  children: React.ReactNode;
  index: number;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.sectionContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: "#8E44AD" }]}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sectionCard}>{children}</View>
    </Animated.View>
  );
};

const CustomSwitch = ({
  value,
  onValueChange,
  activeColor,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor: string;
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3a3a40", activeColor],
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onValueChange(!value);
      }}
    >
      <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
        <Animated.View
          style={[styles.switchThumb, { transform: [{ translateX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
};

const QualityModal = ({
  visible,
  onClose,
  title,
  selectedOption,
  onSelect,
  activeColor,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  selectedOption: AudioQuality;
  onSelect: (opt: AudioQuality) => void;
  activeColor: string;
}) => {
  const options: { label: string; value: AudioQuality }[] = [
    { label: "Low (64kbps)", value: "low" },
    { label: "Normal (128kbps)", value: "normal" },
    { label: "High (256kbps)", value: "high" },
    { label: "Best (High Efficiency)", value: "best" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View
              style={[
                styles.modalHandle,
                { backgroundColor: activeColor + "40" },
              ]}
            />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.modalOption}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSelect(option.value);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  selectedOption === option.value && {
                    color: activeColor,
                    fontWeight: "bold",
                  },
                ]}
              >
                {option.label}
              </Text>
              {selectedOption === option.value && (
                <Ionicons name="checkmark" size={20} color={activeColor} />
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }}
          >
            <Text style={styles.modalCloseText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const accentColors = [
  "#dab9ff", // Default primary
  "#46f5e0", // Secondary
  "#ffb9b9", // Pink
  "#b9ffb9", // Green
  "#b9d9ff", // Blue
  "#ffe6b9", // Yellow
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, setAccentColor, accentColor } = useTheme();

  const settings = useSettingsStore();
  const deviceState = useDeviceStateStore();
  const downloadedTracks = useDownloadStore((s) => s.downloadedTracks);

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [modalType, setModalType] = useState<null | "streamingWifi" | "streamingCellular" | "downloadWifi" | "downloadCellular">(null);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = async () => {
    const stats = await CacheManager.getCacheStats();
    setStorageStats(stats);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return "< 1 MB";
    if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const downloadCount = useMemo(
    () => Object.keys(downloadedTracks).length,
    [downloadedTracks],
  );

  const handleClearCache = (type: 'song' | 'metadata' | 'artwork' | 'lyrics') => {
    Alert.alert(
      "Clear Cache",
      `Are you sure you want to clear the ${type} cache? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              if (type === 'song') await CacheManager.clearSongCache();
              else if (type === 'metadata') await CacheManager.clearMetadataCache();
              else if (type === 'artwork') await CacheManager.clearArtworkCache();
              else if (type === 'lyrics') await CacheManager.clearLyricsCache();
              
              await refreshStats();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const handleClearDownloads = () => {
    Alert.alert(
      "Clear Downloads",
      `Are you sure you want to delete all ${downloadCount} downloaded songs? They will still be playable online.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setIsClearing(true);
            try {
              const res = await downloadCleanupService.clearAllDownloads();
              if (res.success) {
                await refreshStats();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } finally {
              setIsClearing(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenEQ = async () => {
    const res = await AudioSessionController.openEqualizer();
    if (!res.success) {
      Alert.alert("Equalizer", "No compatible equalizer found on this device.");
    }
  };

  const crossfadePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const val = Math.round((x / (SCREEN_WIDTH - 80)) * 12);
        settings.setCrossfadeDuration(Math.max(0, Math.min(12, val)));
        Haptics.selectionAsync();
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const val = Math.round((x / (SCREEN_WIDTH - 80)) * 12);
        settings.setCrossfadeDuration(Math.max(0, Math.min(12, val)));
      },
    })
  ).current;

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={themeColors.on_surface} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 160 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* PLAYBACK SECTION */}
        <SettingSection title="Playback" index={0}>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Crossfade</Text>
              <Text style={styles.settingItemSubtext}>
                {settings.crossfadeEnabled ? `${settings.crossfadeDuration} seconds` : "Disabled"}
              </Text>
            </View>
            <CustomSwitch
              value={settings.crossfadeEnabled}
              onValueChange={() => settings.toggleSetting("crossfadeEnabled")}
              activeColor={accentColor}
            />
          </View>

          {settings.crossfadeEnabled && (
            <View style={styles.sliderContainer}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderValue}>0s</Text>
                <View style={styles.sliderTrackBg}>
                  <View 
                    style={[
                      styles.sliderFill, 
                      { 
                        width: `${(settings.crossfadeDuration / 12) * 100}%`,
                        backgroundColor: accentColor 
                      }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.sliderKnob,
                      { 
                        left: `${(settings.crossfadeDuration / 12) * 100}%`,
                        backgroundColor: "#fff",
                        borderColor: accentColor,
                      }
                    ]}
                  />
                  <View 
                    style={StyleSheet.absoluteFill}
                    {...crossfadePanResponder.panHandlers}
                  />
                </View>
                <Text style={styles.sliderValue}>12s</Text>
              </View>
            </View>
          )}

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Gapless Playback</Text>
              <Text style={styles.settingItemSubtext}>Continuous audio experience</Text>
            </View>
            <CustomSwitch
              value={settings.gaplessPlayback}
              onValueChange={() => settings.toggleSetting("gaplessPlayback")}
              activeColor={accentColor}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Normalize Volume</Text>
              <Text style={styles.settingItemSubtext}>Maintain consistent loudness</Text>
            </View>
            <CustomSwitch
              value={settings.normalizeVolume}
              onValueChange={() => settings.toggleSetting("normalizeVolume")}
              activeColor={accentColor}
            />
          </View>

          <TouchableOpacity style={styles.settingItem} onPress={handleOpenEQ}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Equalizer</Text>
              <Text style={styles.settingItemSubtext}>System audio effects</Text>
            </View>
            <MaterialCommunityIcons
              name="waveform"
              size={20}
              color={accentColor}
            />
          </TouchableOpacity>
        </SettingSection>

        {/* AUDIO QUALITY SECTION */}
        <SettingSection title="Audio Quality" index={1}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalType("streamingWifi")}
          >
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Streaming (Wi-Fi)</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>
                {settings.streamingQualityWifi.toUpperCase()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors.on_surface_muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalType("streamingCellular")}
          >
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Streaming (Cellular)</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>
                {settings.streamingQualityCellular.toUpperCase()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors.on_surface_muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalType("downloadWifi")}
          >
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Download (Wi-Fi)</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>
                {settings.downloadQualityWifi.toUpperCase()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors.on_surface_muted}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setModalType("downloadCellular")}
          >
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Download (Cellular)</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>
                {settings.downloadQualityCellular.toUpperCase()}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors.on_surface_muted}
            />
          </TouchableOpacity>
        </SettingSection>

        {/* DOWNLOADS & STORAGE SECTION */}
        <SettingSection title="Downloads & Storage" index={2}>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Download over Wi-Fi only</Text>
            </View>
            <CustomSwitch
              value={settings.downloadOnlyOnWifi}
              onValueChange={() => settings.toggleSetting("downloadOnlyOnWifi")}
              activeColor={accentColor}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Auto-download Liked Songs</Text>
            </View>
            <CustomSwitch
              value={settings.autoDownloadLikedSongs}
              onValueChange={() => settings.toggleSetting("autoDownloadLikedSongs")}
              activeColor={accentColor}
            />
          </View>

          <View style={styles.storageInfoContainer}>
            <Text style={styles.storageTitle}>Storage Usage</Text>
            <View style={styles.storageBar}>
               <View 
                 style={[
                   styles.storageSegment, 
                   { 
                     width: `${Math.max(2, ((storageStats?.downloads || 0) / (storageStats?.totalSize || 1)) * 100)}%`, 
                     backgroundColor: accentColor 
                   }
                 ]} 
               />
               <View 
                 style={[
                   styles.storageSegment, 
                   { 
                     width: `${Math.max(2, ((storageStats?.songCache || 0) / (storageStats?.totalSize || 1)) * 100)}%`, 
                     backgroundColor: '#555' 
                   }
                 ]} 
               />
            </View>
            
            <View style={styles.storageDetailRow}>
              <View style={styles.storageDetailItem}>
                <View style={[styles.storageDot, { backgroundColor: accentColor }]} />
                <Text style={styles.storageDetailLabel}>Downloads</Text>
                <Text style={styles.storageDetailValue}>{formatSize(storageStats?.downloads || 0)}</Text>
              </View>
              <View style={styles.storageDetailItem}>
                <View style={[styles.storageDot, { backgroundColor: '#555' }]} />
                <Text style={styles.storageDetailLabel}>Cache</Text>
                <Text style={styles.storageDetailValue}>{formatSize(storageStats?.songCache || 0)}</Text>
              </View>
            </View>

            <View style={styles.cacheActions}>
              <TouchableOpacity style={styles.cacheActionBtn} onPress={() => handleClearCache('song')}>
                <Text style={styles.cacheActionText}>Clear Cache</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.cacheActionBtn, { backgroundColor: 'rgba(255,59,48,0.1)' }]} onPress={handleClearDownloads}>
                <Text style={[styles.cacheActionText, { color: '#FF3B30' }]}>Clear Downloads</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Max Song Cache</Text>
              <Text style={styles.settingItemSubtext}>{settings.maxSongCacheGB} GB</Text>
            </View>
            <View style={styles.cacheLimitButtons}>
               {[2, 5, 10].map(val => (
                 <TouchableOpacity 
                   key={val} 
                   style={[styles.limitBtn, settings.maxSongCacheGB === val && { backgroundColor: accentColor }]}
                   onPress={() => settings.setMaxSongCache(val)}
                 >
                   <Text style={[styles.limitText, settings.maxSongCacheGB === val && { color: '#000' }]}>{val}G</Text>
                 </TouchableOpacity>
               ))}
            </View>
          </View>
        </SettingSection>

        {/* ACCESSIBILITY SECTION */}
        <SettingSection title="Accessibility" index={3}>
           <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Reduce Motion</Text>
              <Text style={styles.settingItemSubtext}>Simplify animations and transitions</Text>
            </View>
            <CustomSwitch
              value={settings.reduceMotion}
              onValueChange={() => settings.toggleSetting("reduceMotion")}
              activeColor={accentColor}
            />
          </View>

          <View style={styles.accentColorContainer}>
            <Text style={styles.settingItemLabel}>Accent Color</Text>
            <View style={styles.colorRow}>
              {accentColors.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setAccentColor(color);
                    settings.setAccentColor(color);
                  }}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    accentColor === color && {
                      borderColor: "#fff",
                      borderWidth: 2.5,
                    },
                  ]}
                >
                  {accentColor === color && (
                    <View style={styles.innerColorCircle} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SettingSection>

        {/* SUPPORT & ABOUT */}
        <SettingSection title="Support & About" index={4}>
          <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert("FAQ", "Online help center coming soon.")}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Frequently Asked Questions</Text>
            </View>
            <Ionicons name="help-circle-outline" size={22} color={themeColors.on_surface_muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => Alert.alert("AuraMusic", "AuraMusic v1.0.0\nBuilt with Expo SDK 55\nPlayback Engine: RNTP 5.0")}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>About AuraMusic</Text>
              <Text style={styles.settingItemSubtext}>Version 1.0.0 (Build 2405)</Text>
            </View>
            <Ionicons name="information-circle-outline" size={22} color={themeColors.on_surface_muted} />
          </TouchableOpacity>
        </SettingSection>

        <View style={styles.footer}>
          <View style={styles.diagnosticContainer}>
            <Text style={styles.diagnosticText}>
              Connection: {deviceState.isWifi ? 'Wi-Fi' : (deviceState.isCellular ? 'Cellular' : 'None')}
            </Text>
            <Text style={styles.diagnosticText}>
              Audio Route: {deviceState.audioRoute.toUpperCase()} {deviceState.bluetoothCodec ? `(${deviceState.bluetoothCodec})` : ''}
            </Text>
            <Text style={styles.diagnosticText}>
              Streaming Quality: {deviceState.isWifi ? settings.streamingQualityWifi.toUpperCase() : settings.streamingQualityCellular.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.footerBrand}>AuraMusic</Text>
          <Text style={styles.footerVersion}>Made with ❤️ for Music Lovers</Text>
        </View>
      </ScrollView>

      <QualityModal
        visible={!!modalType}
        onClose={() => setModalType(null)}
        title={
          modalType === "streamingWifi" ? "Streaming (Wi-Fi)" :
          modalType === "streamingCellular" ? "Streaming (Cellular)" :
          modalType === "downloadWifi" ? "Download (Wi-Fi)" : "Download (Cellular)"
        }
        selectedOption={
          modalType === "streamingWifi" ? settings.streamingQualityWifi :
          modalType === "streamingCellular" ? settings.streamingQualityCellular :
          modalType === "downloadWifi" ? settings.downloadQualityWifi : settings.downloadQualityCellular
        }
        onSelect={(q) => {
          if (modalType === "streamingWifi") settings.setStreamingQuality("wifi", q);
          else if (modalType === "streamingCellular") settings.setStreamingQuality("cellular", q);
          else if (modalType === "downloadWifi") settings.setDownloadQuality("wifi", q);
          else if (modalType === "downloadCellular") settings.setDownloadQuality("cellular", q);
        }}
        activeColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: typography.headlineFont,
    color: baseColors.on_surface,
    fontWeight: 'bold'
  },
  scrollContent: { paddingHorizontal: spacing.md },
  sectionContainer: { marginTop: spacing.xl },
  sectionTitle: {
    fontSize: 12,
    fontFamily: typography.labelFont,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    letterSpacing: 1.5,
  },
  sectionCard: {
    backgroundColor: "#1b1b20",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.02)",
  },
  settingItemLeft: { flex: 1 },
  settingItemLabel: {
    fontSize: 16,
    fontFamily: typography.labelFont,
    color: baseColors.on_surface,
  },
  settingItemSubtext: {
    fontSize: 12,
    fontFamily: typography.bodyFont,
    color: baseColors.on_surface_muted,
    marginTop: 4,
  },
  switchTrack: {
    width: 48,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  sliderContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  sliderValue: {
    color: baseColors.on_surface_muted,
    fontSize: 10,
    width: 24,
    textAlign: "center",
  },
  sliderTrackBg: { 
    flex: 1, 
    height: 4, 
    borderRadius: 2, 
    backgroundColor: "rgba(255,255,255,0.1)",
    position: 'relative'
  },
  sliderFill: { height: "100%", borderRadius: 2 },
  sliderKnob: {
    position: "absolute",
    top: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    zIndex: 10,
    marginLeft: -10
  },
  storageInfoContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.02)",
  },
  storageTitle: {
    fontSize: 14,
    color: baseColors.on_surface,
    marginBottom: 12,
    fontFamily: typography.labelFont
  },
  storageBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16
  },
  storageSegment: { height: '100%' },
  storageDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  storageDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  storageDot: { width: 8, height: 8, borderRadius: 4 },
  storageDetailLabel: { fontSize: 12, color: baseColors.on_surface_muted },
  storageDetailValue: { fontSize: 12, color: baseColors.on_surface, fontWeight: 'bold' },
  cacheActions: {
    flexDirection: 'row',
    gap: 12
  },
  cacheActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center'
  },
  cacheActionText: {
    fontSize: 12,
    color: baseColors.on_surface,
    fontFamily: typography.labelFont
  },
  cacheLimitButtons: {
    flexDirection: 'row',
    gap: 8
  },
  limitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  limitText: { fontSize: 12, color: baseColors.on_surface },
  accentColorContainer: { padding: 20 },
  colorRow: { flexDirection: "row", marginTop: spacing.md, gap: 12 },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  innerColorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  diagnosticContainer: {
    marginBottom: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    width: '100%',
    alignItems: 'center'
  },
  diagnosticText: {
    fontSize: 10,
    color: baseColors.on_surface_muted,
    fontFamily: typography.bodyFont,
    lineHeight: 14
  },
  footer: { marginTop: 40, alignItems: "center", opacity: 0.5 },
  footerBrand: {
    fontSize: 18,
    fontFamily: typography.headlineFont,
    color: baseColors.on_surface,
  },
  footerVersion: {
    fontSize: 10,
    fontFamily: typography.bodyFont,
    color: baseColors.on_surface_muted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalDismiss: { flex: 1 },
  modalContent: {
    backgroundColor: "#1b1b20",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { alignItems: "center", marginBottom: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  modalTitle: {
    fontSize: 18,
    fontFamily: typography.headlineFont,
    color: baseColors.on_surface,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  modalOptionText: { fontSize: 16, color: baseColors.on_surface },
  modalCloseBtn: { marginTop: 20, alignItems: "center", padding: 10 },
  modalCloseText: {
    color: baseColors.on_surface_muted,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "bold",
  },
});

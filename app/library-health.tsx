import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AtmosphericBackground } from '@/src/components/ui/atmospheric-background';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { palette, radius, spacing, typography, motion, glass } from '@/src/design/tokens';
import { useLibraryHealthStore } from '@/src/features/library-health/store/library-health.store';
import { LibraryHealthService } from '@/src/services/library-health.service';
import { DuplicateGroup, PendingDeletion } from '@/src/features/library-health/types/library-health';

const { width: SW } = Dimensions.get('window');

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function LibraryHealthScreen() {
  const insets = useSafeAreaInsets();
  const store = useLibraryHealthStore();
  
  const {
    healthReport,
    duplicateGroups,
    ignoredDuplicateGroups,
    healthHistory,
    isScanning,
    scanProgress,
    scanStage,
    pendingDeletions,
    undoExpiresAt,
    telemetry,
    ignoreGroup,
    clearScanCache,
  } = store;

  // Modal confirm states
  const [selectedGroupToMerge, setSelectedGroupToMerge] = useState<DuplicateGroup | null>(null);
  const [showMergeAllConfirm, setShowMergeAllConfirm] = useState(false);

  // Undo Toast Countdown State
  const [timeLeft, setTimeLeft] = useState(0);

  // Update Undo Toast countdown
  useEffect(() => {
    if (!undoExpiresAt) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, undoExpiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [undoExpiresAt]);

  // Filter duplicate groups
  const visibleGroups = useMemo(() => {
    return duplicateGroups.filter(
      (g) => !ignoredDuplicateGroups.includes(g.id) && g.tracks.some((t) => t.exists)
    );
  }, [duplicateGroups, ignoredDuplicateGroups]);

  // Filter groups with >=95% confidence for safe merging
  const safeGroups = useMemo(() => {
    return visibleGroups.filter((g) => g.confidence >= 95);
  }, [visibleGroups]);

  // Total safe size recovery
  const safeRecoveryBytes = useMemo(() => {
    let bytes = 0;
    for (const group of safeGroups) {
      const recId = group.recommendedTrackId;
      const dups = group.tracks.filter((t) => t.id !== recId);
      for (const d of dups) {
        bytes += d.fileSize || 0;
      }
    }
    return bytes;
  }, [safeGroups]);

  const handleManualScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LibraryHealthService.scanLibrary('manual');
  }, []);

  const handleClearCache = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Reset Health Data',
      'Are you sure you want to clear the cached reports and scan index? A full rebuild will run on the next audit.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            clearScanCache();
            LibraryHealthService.scanLibrary('manual');
          },
        },
      ]
    );
  }, [clearScanCache]);

  const handleIgnoreGroup = useCallback((groupId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    ignoreGroup(groupId);
  }, [ignoreGroup]);

  // Trigger group-specific deduplication confirmation sheet
  const handleKeepRecommended = useCallback((group: DuplicateGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGroupToMerge(group);
  }, []);

  // Commit deletion for single group
  const executeSingleGroupDeduplicate = useCallback(() => {
    if (!selectedGroupToMerge) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const group = selectedGroupToMerge;
    setSelectedGroupToMerge(null);

    const recId = group.recommendedTrackId;
    const dups = group.tracks.filter((t) => t.id !== recId);

    const pending: PendingDeletion[] = dups.map((dup) => {
      const isDownload = !!(!dup.isLocal || dup.localUri?.includes('documentDirectory') || dup.localUri?.includes('aura/audio'));
      return {
        groupId: group.id,
        trackId: dup.id,
        filePath: dup.localUri || dup.url || '',
        isDownload,
      };
    });

    LibraryHealthService.registerDeletions(pending);
  }, [selectedGroupToMerge]);

  const executeMergeAllSafe = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowMergeAllConfirm(false);

    const allPending: PendingDeletion[] = [];
    for (const group of safeGroups) {
      const recId = group.recommendedTrackId;
      const dups = group.tracks.filter((t) => t.id !== recId);
      
      dups.forEach((dup) => {
        const isDownload = !!(!dup.isLocal || dup.localUri?.includes('documentDirectory') || dup.localUri?.includes('aura/audio'));
        allPending.push({
          groupId: group.id,
          trackId: dup.id,
          filePath: dup.localUri || dup.url || '',
          isDownload,
        });
      });
    }

    if (allPending.length > 0) {
      LibraryHealthService.registerDeletions(allPending);
    }
  }, [safeGroups]);

  const handleUndo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LibraryHealthService.rollbackDeletions();
  }, []);

  const getConfidenceLabel = (score: number) => {
    if (score >= 98) return 'IDENTICAL';
    if (score >= 95) return 'VERY LIKELY';
    if (score >= 90) return 'LIKELY';
    return 'UNCERTAIN';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="shield-checkmark-outline" size={80} color="rgba(71, 227, 154, 0.35)" />
      <Text style={styles.emptyTitle}>Your library is healthy</Text>
      <Text style={styles.emptySubtitle}>
        No duplicates or issues found. We'll let you know if that changes during the next scan.
      </Text>
      <PressScale onPress={handleManualScan} style={styles.rescanBtn}>
        <LiquidGlass borderRadius={24} style={styles.rescanGlass}>
          <Text style={styles.rescanText}>Run Manual Scan</Text>
        </LiquidGlass>
      </PressScale>
    </View>
  );

  return (
    <View style={styles.container}>
      <AtmosphericBackground colors={[palette.success, palette.primary]} />
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Library Health</Text>
            <Text style={styles.subtitle}>Smart Clean & Optimization</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleClearCache} style={styles.clearBtn}>
            <Ionicons name="refresh-outline" size={22} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <LiquidGlass style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.scoreContainer}>
              <View style={[styles.scoreRing, { borderColor: healthReport?.healthScore && healthReport.healthScore > 90 ? palette.success : palette.primary }]}>
                <Text style={styles.scoreValue}>{healthReport?.healthScore || '--'}</Text>
              </View>
              <Text style={styles.scoreLabel}>Health Score</Text>
            </View>
            
            <View style={styles.statsDivider} />
            
            <View style={styles.statsColumn}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{healthReport?.totalTracks || 0}</Text>
                <Text style={styles.statLabel}>Total Tracks</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatBytes(healthReport?.storageWasteBytes || 0)}</Text>
                <Text style={styles.statLabel}>Optimization Potential</Text>
              </View>
            </View>
          </View>

          {isScanning && (
            <View style={styles.scanProgressContainer}>
              <View style={styles.scanLabelRow}>
                <Text style={styles.scanStageText}>{scanStage || 'Analyzing...'}</Text>
                <Text style={styles.scanPercentText}>{Math.round(scanProgress)}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${scanProgress}%` }]} />
              </View>
            </View>
          )}
        </LiquidGlass>

        {/* Quick Actions */}
        {safeGroups.length > 0 && (
          <PressScale onPress={() => setShowMergeAllConfirm(true)} style={styles.quickActionBtn}>
            <LiquidGlass borderRadius={24} style={styles.quickActionGlass} gradient accentColor={palette.success} accentOpacity={0.15}>
              <View style={styles.quickActionContent}>
                <Ionicons name="sparkles" size={24} color={palette.success} />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.quickActionTitle}>One-Tap Optimization</Text>
                  <Text style={styles.quickActionSub}>Recover {formatBytes(safeRecoveryBytes)} from {safeGroups.length} safe groups</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
              </View>
            </LiquidGlass>
          </PressScale>
        )}

        {/* Duplicate Groups */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Potential Duplicates ({visibleGroups.length})</Text>
        </View>

        {visibleGroups.length === 0 && !isScanning ? (
          renderEmptyState()
        ) : (
          <View style={styles.groupsList}>
            {visibleGroups.map((group) => {
              const recTrack = group.tracks.find((t) => t.id === group.recommendedTrackId) || group.tracks[0];
              const duplicateTracks = group.tracks.filter((t) => t.id !== group.recommendedTrackId);

              const getSeverityColor = (sev: string) => {
                if (sev === 'low') return palette.success;
                if (sev === 'medium') return palette.amber;
                return palette.coral;
              };

              return (
                <LiquidGlass key={group.id} style={styles.groupCard}>
                  {/* Group Card Header */}
                  <View style={styles.groupHeader}>
                    <View style={styles.groupMetaColumn}>
                      <View style={styles.badgeRow}>
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              borderColor:
                                group.confidence >= 95 ? palette.success : palette.primary,
                            },
                          ]}
                        >
                          <Text style={styles.typeBadgeText}>
                            {getConfidenceLabel(group.confidence)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.sevBadge,
                            { borderColor: getSeverityColor(group.severity) },
                          ]}
                        >
                          <Text
                            style={[
                              styles.sevBadgeText,
                              { color: getSeverityColor(group.severity) },
                            ]}
                          >
                            {group.severity.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.groupTrackTitle} numberOfLines={1}>
                        {recTrack.title}
                      </Text>
                      <Text style={styles.groupTrackArtist} numberOfLines={1}>
                        {recTrack.artist}
                      </Text>
                    </View>

                    <AuraArtwork
                      source={resolveArtwork({ art: recTrack.art, title: recTrack.title }, 'card')}
                      entityName={recTrack.title}
                      entityType="song"
                      style={styles.groupArt}
                      contentFit="cover"
                      transition={120}
                      cachePolicy="memory-disk"
                      borderRadius={10}
                    />
                  </View>

                  {/* Recommended Version */}
                  <View style={styles.versionContainer}>
                    <View style={styles.versionLabelRow}>
                      <Text style={styles.versionLabel}>RECOMMENDED TO KEEP</Text>
                      <View style={styles.recommendedTag}>
                        <Text style={styles.recommendedTagText}>HIGHEST QUALITY</Text>
                      </View>
                    </View>
                    <Text style={styles.trackDetailsText} numberOfLines={1}>
                      {formatBytes(recTrack.fileSize || 0)} · {recTrack.album || 'No Album'}
                    </Text>
                    <Text style={styles.trackPathText} numberOfLines={1}>
                      {recTrack.localUri || recTrack.url || ''}
                    </Text>
                  </View>

                  {/* Duplicates to Delete */}
                  {duplicateTracks.map((dup) => (
                    <View key={dup.id} style={styles.dupVersionContainer}>
                      <View style={styles.versionLabelRow}>
                        <Text style={styles.dupVersionLabel}>DUPLICATE VERSION</Text>
                        <Text style={styles.wasteLabel}>
                          Waste: {formatBytes(dup.fileSize || 0)}
                        </Text>
                      </View>
                      <Text style={styles.trackDetailsText} numberOfLines={1}>
                        {formatBytes(dup.fileSize || 0)} · {dup.album || 'No Album'}
                      </Text>
                      <Text style={styles.trackPathText} numberOfLines={1}>
                        {dup.localUri || dup.url || ''}
                      </Text>
                    </View>
                  ))}

                  {/* Action Bar */}
                  <View style={styles.groupActions}>
                    <TouchableOpacity
                      onPress={() => handleIgnoreGroup(group.id)}
                      style={styles.ignoreBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.ignoreBtnText}>Ignore Group</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleKeepRecommended(group)}
                      style={styles.mergeBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.mergeBtnText}>Keep Recommended Only</Text>
                    </TouchableOpacity>
                  </View>
                </LiquidGlass>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Undo Toast */}
      {pendingDeletions.length > 0 && timeLeft > 0 && (
        <View style={[styles.undoToastContainer, { bottom: insets.bottom + 20 }]}>
          <LiquidGlass borderRadius={20} style={styles.undoToastGlass} gradient accentColor={palette.primary} accentOpacity={0.2}>
            <View style={styles.undoToastContent}>
              <View style={styles.undoIcon}>
                <Ionicons name="trash-outline" size={22} color="#FFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.undoTitle}>Cleaned {pendingDeletions.length} files</Text>
                <Text style={styles.undoSub}>Reversing in {Math.ceil(timeLeft / 1000)}s...</Text>
              </View>
              <TouchableOpacity onPress={handleUndo} style={styles.undoBtn}>
                <Text style={styles.undoBtnText}>UNDO</Text>
              </TouchableOpacity>
            </View>
          </LiquidGlass>
        </View>
      )}

      {/* Merge Confirmation Modal */}
      <Modal visible={!!selectedGroupToMerge} transparent animationType="fade" onRequestClose={() => setSelectedGroupToMerge(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelectedGroupToMerge(null)}>
             <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          <View style={styles.modalContainer}>
            <LiquidGlass borderRadius={32} style={styles.confirmCard}>
               <Ionicons name="trash-outline" size={40} color={palette.coral} style={{ marginBottom: 16 }} />
               <Text style={styles.modalTitle}>Confirm Cleanup</Text>
               <Text style={styles.modalSub}>
                 This will permanently delete the duplicate files from your device. You will keep the highest quality version.
               </Text>
               <View style={styles.modalButtons}>
                 <TouchableOpacity onPress={() => setSelectedGroupToMerge(null)} style={styles.modalCancelBtn}>
                   <Text style={styles.modalCancelText}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={executeSingleGroupDeduplicate} style={styles.modalDeleteBtn}>
                   <Text style={styles.modalDeleteText}>Delete Duplicates</Text>
                 </TouchableOpacity>
               </View>
            </LiquidGlass>
          </View>
        </View>
      </Modal>

      {/* Merge All Confirmation */}
      <Modal visible={showMergeAllConfirm} transparent animationType="fade" onRequestClose={() => setShowMergeAllConfirm(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMergeAllConfirm(false)}>
             <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          </TouchableOpacity>
          <View style={styles.modalContainer}>
            <LiquidGlass borderRadius={32} style={styles.confirmCard} accentColor={palette.success} accentOpacity={0.1}>
               <Ionicons name="sparkles-outline" size={44} color={palette.success} style={{ marginBottom: 16 }} />
               <Text style={styles.modalTitle}>Smart Cleanup</Text>
               <Text style={styles.modalSub}>
                 Optimizing {safeGroups.length} groups of duplicates. We've verified these matches with 95%+ confidence.
                 {'\n\n'}You'll recover {formatBytes(safeRecoveryBytes)} instantly.
               </Text>
               <View style={styles.modalButtons}>
                 <TouchableOpacity onPress={() => setShowMergeAllConfirm(false)} style={styles.modalCancelBtn}>
                   <Text style={styles.modalCancelText}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={executeMergeAllSafe} style={[styles.modalDeleteBtn, { backgroundColor: palette.success }]}>
                   <Text style={[styles.modalDeleteText, { color: '#000' }]}>Recover Space</Text>
                 </TouchableOpacity>
               </View>
            </LiquidGlass>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: palette.inkMuted,
    fontWeight: '500',
  },
  clearBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    padding: 24,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsDivider: {
    width: 1,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 32,
  },
  statsColumn: {
    flex: 1,
    gap: 16,
  },
  statItem: {
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 11,
    color: palette.inkMuted,
    fontWeight: '500',
  },
  scanProgressContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  scanLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scanStageText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  scanPercentText: {
    fontSize: 12,
    color: palette.primary,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: palette.primary,
  },
  quickActionBtn: {
    marginBottom: 32,
  },
  quickActionGlass: {
    padding: 16,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  quickActionSub: {
    fontSize: 12,
    color: palette.inkMuted,
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    opacity: 0.6,
  },
  groupsList: {
    gap: 16,
  },
  groupCard: {
    padding: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupMetaColumn: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  groupTrackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  groupTrackArtist: {
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: 2,
  },
  groupArt: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginLeft: 16,
  },
  versionContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  versionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  versionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.success,
    letterSpacing: 0.5,
  },
  recommendedTag: {
    backgroundColor: 'rgba(71, 227, 154, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: palette.success,
  },
  trackDetailsText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  trackPathText: {
    fontSize: 10,
    color: palette.inkMuted,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dupVersionContainer: {
    backgroundColor: 'rgba(255, 69, 58, 0.04)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.1)',
  },
  dupVersionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.coral,
    letterSpacing: 0.5,
  },
  wasteLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.coral,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  ignoreBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ignoreBtnText: {
    fontSize: 12,
    color: palette.inkMuted,
    fontWeight: '700',
  },
  mergeBtn: {
    flex: 2,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mergeBtnText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.inkMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  rescanBtn: {
    marginTop: 32,
  },
  rescanGlass: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  rescanText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  undoToastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  undoToastGlass: {
    padding: 16,
  },
  undoToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  undoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  undoSub: {
    fontSize: 12,
    color: palette.inkMuted,
    marginTop: 2,
  },
  undoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFF',
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    width: SW * 0.85,
  },
  confirmCard: {
    padding: 32,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSub: {
    fontSize: 14,
    color: palette.inkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalDeleteBtn: {
    flex: 1.5,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.coral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDeleteText: {
    color: '#FFF',
    fontWeight: '900',
  },
});

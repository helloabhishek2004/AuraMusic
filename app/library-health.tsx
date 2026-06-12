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

  // Trigger merge all confirmation sheet
  const handleMergeAllSafe = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowMergeAllConfirm(true);
  }, []);

  // Commit merge all safe duplicates
  const executeMergeAllSafe = useCallback(() => {
    setShowMergeAllConfirm(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    LibraryHealthService.mergeAllSafeDuplicates();
  }, []);

  const handleUndo = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LibraryHealthService.rollbackDeletions();
  }, []);

  // Format Helper
  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return palette.success;
    if (score >= 80) return palette.cyan;
    if (score >= 60) return palette.amber;
    return palette.coral;
  };

  const getScoreDescription = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Attention';
  };

  // Calculate trends: current score - closest score from 30 days ago
  const trendText = useMemo(() => {
    if (!healthHistory || healthHistory.length < 2 || !healthReport) return null;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    let closestEntry = healthHistory[0];
    let minDiff = Math.abs(closestEntry.timestamp - thirtyDaysAgo);
    
    for (const entry of healthHistory) {
      const diff = Math.abs(entry.timestamp - thirtyDaysAgo);
      if (diff < minDiff) {
        minDiff = diff;
        closestEntry = entry;
      }
    }

    const diff = healthReport.healthScore - closestEntry.score;
    if (diff > 0) return `↑ +${diff} this month`;
    if (diff < 0) return `↓ ${diff} this month`;
    return 'Score stable this month';
  }, [healthHistory, healthReport]);

  return (
    <View style={styles.root}>
      <AtmosphericBackground intensity={0.85} />

      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Library Health</Text>
        <TouchableOpacity
          onPress={handleClearCache}
          style={styles.resetButton}
          accessibilityRole="button"
          accessibilityLabel="Reset health database"
        >
          <Ionicons name="refresh-circle-outline" size={24} color={palette.inkDim} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: insets.bottom + (undoExpiresAt ? 110 : 30) },
        ]}
      >
        {isScanning ? (
          /* Scanning Loader State */
          <LiquidGlass style={styles.scoreCard}>
            <View style={styles.loaderContainer}>
              <Text style={styles.loaderTitle}>Scanning Library...</Text>
              <Text style={styles.loaderStage}>Stage: {scanStage.toUpperCase()}</Text>
              <View style={styles.loaderTrack}>
                <View style={[styles.loaderBar, { width: `${scanProgress}%` }]} />
              </View>
              <Text style={styles.loaderProgressText}>{scanProgress}% Complete</Text>
            </View>
          </LiquidGlass>
        ) : healthReport ? (
          /* Health Overview Summary */
          <View>
            <LiquidGlass style={styles.scoreCard}>
              <View style={styles.scoreHeader}>
                <View style={styles.scoreTextSection}>
                  <Text style={styles.scoreSub}>HEALTH SCORE</Text>
                  <Text
                    style={[styles.scoreDesc, { color: getScoreColor(healthReport.healthScore) }]}
                  >
                    {getScoreDescription(healthReport.healthScore)}
                  </Text>
                  {!!trendText && <Text style={styles.trendText}>{trendText}</Text>}
                </View>

                {/* Score Progress Ring */}
                <View
                  style={[
                    styles.scoreRing,
                    { borderColor: getScoreColor(healthReport.healthScore) },
                  ]}
                >
                  <Text
                    style={[
                      styles.scoreNumber,
                      { color: getScoreColor(healthReport.healthScore) },
                    ]}
                  >
                    {healthReport.healthScore}
                  </Text>
                  <Text style={styles.scoreOutOf}>/100</Text>
                </View>
              </View>

              {/* Recovery Banner & Safe Deduplicate Option */}
              <View style={styles.savingsRow}>
                <View style={styles.savingsTextColumn}>
                  <Text style={styles.savingsLabel}>POTENTIAL SAVINGS</Text>
                  <Text style={styles.savingsVal}>
                    Recover {formatBytes(healthReport.storageWasteBytes)}
                  </Text>
                </View>
                {safeGroups.length > 0 ? (
                  <TouchableOpacity
                    onPress={handleMergeAllSafe}
                    style={styles.mergeButton}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.mergeButtonText}>Merge Safe</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleManualScan}
                    style={styles.rescanButton}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.rescanButtonText}>Rescan</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LiquidGlass>

            {/* Health Indicators (Broken files, missing artwork) */}
            <View style={styles.indicatorRow}>
              <LiquidGlass style={styles.indicatorCard}>
                <Ionicons name="image-outline" size={24} color={palette.cyan} />
                <Text style={styles.indicatorCount}>
                  {healthReport.totalTracks > 0
                    ? healthReport.duplicateTracks // placeholder or compute missing
                    : 0}
                </Text>
                <Text style={styles.indicatorLabel}>Dups Detected</Text>
              </LiquidGlass>

              <LiquidGlass style={styles.indicatorCard}>
                <Ionicons name="alert-circle-outline" size={24} color={palette.coral} />
                <Text style={styles.indicatorCount}>
                  {healthReport.duplicateGroups}
                </Text>
                <Text style={styles.indicatorLabel}>Duplicate Groups</Text>
              </LiquidGlass>
            </View>

            {/* Duplicate Groups Header */}
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Duplicate Groups ({visibleGroups.length})</Text>
              {visibleGroups.length > 0 && (
                <Text style={styles.sectionSubtitle}>Select keep recommended or ignore</Text>
              )}
            </View>

            {/* Duplicate Groups List */}
            {visibleGroups.length > 0 ? (
              visibleGroups.map((group) => {
                const recId = group.recommendedTrackId;
                const recTrack = group.tracks.find((t) => t.id === recId);
                const duplicateTracks = group.tracks.filter((t) => t.id !== recId);

                if (!recTrack) return null;

                // Tonal badges based on confidence
                const getConfidenceLabel = (conf: number) => {
                  if (conf >= 95) return 'Exact Duplicate';
                  if (conf >= 85) return 'Metadata Duplicate';
                  return 'Duration Duplicate';
                };

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
                      <Image
                        source={{ uri: recTrack.art || '' }}
                        style={styles.groupArt}
                        contentFit="cover"
                        transition={120}
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
                        style={styles.dedupeBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dedupeBtnText}>Keep Recommended</Text>
                      </TouchableOpacity>
                    </View>
                  </LiquidGlass>
                );
              })
            ) : (
              /* No Duplicates State */
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles" size={48} color={palette.success} />
                <Text style={styles.emptyTitle}>Your library is healthy</Text>
                <Text style={styles.emptySub}>No duplicate songs or unreferenced audio files detected.</Text>
                <TouchableOpacity
                  onPress={handleManualScan}
                  style={styles.emptyRescanBtn}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyRescanBtnText}>Force Rescan</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* Empty/Initial scan needed */
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-outline" size={48} color={palette.inkDim} />
            <Text style={styles.emptyTitle}>Analyze Library Health</Text>
            <Text style={styles.emptySub}>Scan your library for duplicates, broken tracks, and recovers storage.</Text>
            <TouchableOpacity
              onPress={handleManualScan}
              style={styles.emptyRescanBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyRescanBtnText}>Start Health Audit</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Floating Undo Toast Notification */}
      {!!undoExpiresAt && timeLeft > 0 && (
        <View style={[styles.undoToastContainer, { bottom: insets.bottom + 20 }]}>
          <LiquidGlass borderRadius={20} intensity={30} style={styles.undoToastGlass}>
            <View style={styles.undoToastContent}>
              <Ionicons name="trash-outline" size={20} color={palette.coral} />
              <View style={styles.undoToastTextWrap}>
                <Text style={styles.undoToastTitle}>Duplicates scheduled for removal</Text>
                <Text style={styles.undoToastSubtitle}>
                  Physical file deletion in {Math.ceil(timeLeft / 1000)}s
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleUndo}
                style={styles.undoBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.undoBtnText}>Undo</Text>
              </TouchableOpacity>
            </View>
            {/* Undo countdown bar */}
            <View style={styles.undoProgressTrack}>
              <View style={[styles.undoProgressBar, { width: `${(timeLeft / 15000) * 100}%` }]} />
            </View>
          </LiquidGlass>
        </View>
      )}

      {/* Manual Deduplicate Apple Confirmation Sheet */}
      <Modal
        visible={selectedGroupToMerge !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGroupToMerge(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCentered}>
            <LiquidGlass borderRadius={24} style={styles.modalGlass}>
              <View style={styles.modalContent}>
                <Ionicons name="checkmark-circle-outline" size={36} color={palette.primary} style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Deduplicate song</Text>
                <Text style={styles.modalSub}>
                  You'll keep the recommended version.
                </Text>
                <View style={styles.modalDetailBox}>
                  <Text style={styles.modalDetailText}>
                    • 1 duplicate file will be removed.
                  </Text>
                  <Text style={styles.modalDetailText}>
                    • Playlists references will be updated.
                  </Text>
                  {selectedGroupToMerge && (
                    <Text style={styles.modalDetailText}>
                      • Recover{' '}
                      {formatBytes(
                        selectedGroupToMerge.tracks
                          .filter((t) => t.id !== selectedGroupToMerge.recommendedTrackId)
                          .reduce((sum, t) => sum + (t.fileSize || 0), 0)
                      )}{' '}
                      of storage.
                    </Text>
                  )}
                </View>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    onPress={() => setSelectedGroupToMerge(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={executeSingleGroupDeduplicate}
                    style={styles.modalConfirmBtn}
                  >
                    <Text style={styles.modalConfirmBtnText}>Deduplicate</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LiquidGlass>
          </View>
        </View>
      </Modal>

      {/* Merge All Safe Confirmation Sheet */}
      <Modal
        visible={showMergeAllConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMergeAllConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCentered}>
            <LiquidGlass borderRadius={24} style={styles.modalGlass}>
              <View style={styles.modalContent}>
                <Ionicons name="sparkles-outline" size={36} color={palette.success} style={styles.modalIcon} />
                <Text style={styles.modalTitle}>Merge All Safe Duplicates</Text>
                <Text style={styles.modalSub}>
                  Merge all duplicate song groups with {'>'}=95% confidence.
                </Text>
                <View style={styles.modalDetailBox}>
                  <Text style={styles.modalDetailText}>
                    • Keep the highest quality version of each song.
                  </Text>
                  <Text style={styles.modalDetailText}>
                    • {safeGroups.length} duplicate groups will be resolved.
                  </Text>
                  <Text style={styles.modalDetailText}>
                    • Playlists references will be preserved.
                  </Text>
                  <Text style={styles.modalDetailText}>
                    • Recover {formatBytes(safeRecoveryBytes)} of storage.
                  </Text>
                </View>
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    onPress={() => setShowMergeAllConfirm(false)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={executeMergeAllSafe}
                    style={styles.modalConfirmBtn}
                  >
                    <Text style={styles.modalConfirmBtnText}>Merge All</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LiquidGlass>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 100,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  scoreCard: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  scoreTextSection: {
    flex: 1,
  },
  scoreSub: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.inkDim,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  scoreDesc: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.inkMuted,
  },
  scoreRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  scoreNumber: {
    fontSize: 24,
    fontWeight: '900',
  },
  scoreOutOf: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.inkDim,
    marginTop: -2,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
  },
  savingsTextColumn: {
    flex: 1,
  },
  savingsLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.inkDim,
    letterSpacing: 1,
    marginBottom: 2,
  },
  savingsVal: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  mergeButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mergeButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rescanButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rescanButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  indicatorCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  indicatorCount: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    marginTop: 8,
    marginBottom: 2,
  },
  indicatorLabel: {
    fontSize: 11,
    color: palette.inkDim,
    fontWeight: '500',
  },
  sectionTitleRow: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: palette.inkDim,
    fontWeight: '500',
    marginTop: 2,
  },
  groupCard: {
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  groupMetaColumn: {
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  typeBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.inkMuted,
  },
  sevBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  groupTrackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.2,
  },
  groupTrackArtist: {
    fontSize: 13,
    color: palette.inkDim,
    fontWeight: '500',
    marginTop: 2,
  },
  groupArt: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: palette.backgroundRaised,
  },
  versionContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(191,90,242,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.12)',
    marginBottom: 12,
  },
  versionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  versionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.primary,
    letterSpacing: 0.8,
  },
  recommendedTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(191,90,242,0.15)',
  },
  recommendedTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: palette.primary,
  },
  trackDetailsText: {
    fontSize: 13,
    color: palette.ink,
    fontWeight: '600',
  },
  trackPathText: {
    fontSize: 10,
    color: palette.inkDim,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dupVersionContainer: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  dupVersionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.inkDim,
    letterSpacing: 0.8,
  },
  wasteLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.coral,
  },
  groupActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  ignoreBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ignoreBtnText: {
    fontSize: 13,
    color: palette.inkMuted,
    fontWeight: '700',
  },
  dedupeBtn: {
    flex: 1.5,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dedupeBtnText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: palette.inkDim,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyRescanBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyRescanBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loaderContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.ink,
    marginBottom: 4,
  },
  loaderStage: {
    fontSize: 11,
    fontWeight: '900',
    color: palette.primary,
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  loaderTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    width: '100%',
    marginBottom: 10,
  },
  loaderBar: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 2,
  },
  loaderProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.inkDim,
  },
  undoToastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
  },
  undoToastGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  undoToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  undoToastTextWrap: {
    flex: 1,
  },
  undoToastTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.ink,
  },
  undoToastSubtitle: {
    fontSize: 11,
    color: palette.inkDim,
    marginTop: 2,
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.ink,
  },
  undoProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  undoProgressBar: {
    height: '100%',
    backgroundColor: palette.coral,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCentered: {
    width: SW - 40,
    maxWidth: 400,
  },
  modalGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalContent: {
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.ink,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: palette.inkMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDetailBox: {
    width: '100%',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 24,
    gap: 8,
  },
  modalDetailText: {
    fontSize: 12,
    color: palette.inkDim,
    fontWeight: '500',
    lineHeight: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.inkMuted,
  },
  modalConfirmBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});

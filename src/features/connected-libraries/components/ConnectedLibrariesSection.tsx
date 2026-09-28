import React, { memo, useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ConnectedPlaylist,
  ConnectedProviderId,
  ConnectedServiceState,
  DevScenario,
} from '../types/provider';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';
import { PROVIDER_METAS } from '../providers/base';
import { providerRegistry } from '../providers/registry';
import { ServiceIcon, SpotifyIcon, YouTubeMusicIcon, AppleMusicIcon } from './ServiceIcons';
import { ConnectedPlaylistCard } from './ConnectedPlaylistCard';
import { ServiceHubModal } from './ServiceHubModal';
import { ManageServiceModal } from './ManageServiceModal';
import { trackResolverService } from '../services/track-resolver.service';
import { useMusic } from '@/src/context/MusicContext';

interface ConnectedLibrariesSectionProps {
  onOpenPlaylist?: (playlistId: string) => void;
}

export const ConnectedLibrariesSection = memo(function ConnectedLibrariesSection({
  onOpenPlaylist,
}: ConnectedLibrariesSectionProps) {
  const {
    services,
    devScenario,
    setDevScenario,
    reconnectService,
    getActiveServicesCount,
    isAnySyncing,
    getExpiredService,
  } = useConnectedLibrariesStore();

  const music = useMusic();

  const [hubVisible, setHubVisible] = useState(false);
  const [manageProvider, setManageProvider] = useState<ConnectedProviderId | null>(null);

  const activeCount = getActiveServicesCount();
  const syncing = isAnySyncing();
  const expiredService = getExpiredService();

  const handleOpenHub = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHubVisible(true);
  }, []);

  const handleOpenManage = useCallback((id: ConnectedProviderId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setManageProvider(id);
  }, []);

  const handlePlaylistPress = useCallback(
    (playlist: ConnectedPlaylist) => {
      onOpenPlaylist?.(playlist.externalId);
    },
    [onOpenPlaylist]
  );

  const handlePlaylistPlay = useCallback(
    async (playlist: ConnectedPlaylist) => {
      try {
        let tracks = playlist.tracks;
        if (!tracks || tracks.length === 0) {
          const provider = providerRegistry.get(playlist.providerId);
          if (provider) {
            tracks = await provider.fetchPlaylistTracks(playlist.externalId);
          }
        }

        if (tracks && tracks.length > 0) {
          const resolved = await trackResolverService.resolvePlaylistTracks(tracks);
          if (resolved.length > 0) {
            await music.setQueue(resolved, 0);
            if (resolved.length < tracks.length && __DEV__) {
              console.log(
                `[ConnectedLibraries] Queued ${resolved.length}/${tracks.length} resolved tracks for "${playlist.title}"`
              );
            }
            return;
          }
        }

        Alert.alert(
          playlist.title,
          `No canonical playable matches could be verified for tracks in "${playlist.title}".`,
          [{ text: 'OK' }]
        );
      } catch (err: any) {
        Alert.alert('Playback Error', err?.message || 'Unable to load playlist tracks.');
      }
    },
    [music]
  );

  // Filter connected services
  const connectedServices = (
    Object.values(services) as ConnectedServiceState[]
  ).filter(
    (s) =>
      s.status === 'connected' ||
      s.status === 'syncing' ||
      s.status === 'auth_expired'
  );

  // Dev Scenario Switcher for Visual Validation (Gated under __DEV__)
  const renderDevScenarioSelector = () => {
    if (!__DEV__) return null;

    const scenarios: { key: DevScenario; label: string }[] = [
      { key: 'REAL', label: 'Real' },
      { key: 'EMPTY', label: 'Empty' },
      { key: 'SINGLE_SERVICE', label: 'Spotify' },
      { key: 'MULTI_SERVICE', label: 'Multi' },
      { key: 'SYNCING', label: 'Syncing' },
      { key: 'AUTH_EXPIRED', label: 'Auth Expired' },
    ];

    return (
      <View style={styles.devSelectorRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devScroll}>
          <Text style={styles.devLabel}>STITCH DEV:</Text>
          {scenarios.map((sc) => {
            const isActive = devScenario === sc.key;
            return (
              <TouchableOpacity
                key={sc.key}
                onPress={() => setDevScenario(sc.key)}
                style={[styles.devPill, isActive && styles.devPillActive]}
              >
                <Text style={[styles.devPillText, isActive && styles.devPillTextActive]}>
                  {sc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.sectionContainer}>
      {renderDevScenarioSelector()}

      {activeCount === 0 ? (
        /* ============================================================ */
        /* SUB-STATE 1: EMPTY WELCOME BANNER (0 services connected)     */
        /* ============================================================ */
        <View style={styles.emptyWrap}>
          <View style={styles.emptyHeaderRow}>
            <View style={styles.titleRow}>
              <View style={styles.primaryDot} />
              <Text style={styles.headerLabel}>CONNECTED LIBRARIES</Text>
            </View>
            <Text style={styles.cloudSyncText}>Cloud Sync</Text>
          </View>

          <View style={styles.emptyGlassCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="cloud-outline" size={18} color="#DAB9FF" />
              <Text style={styles.emptyCardTitle}>Connect your music</Text>
            </View>

            <Text style={styles.emptyCardDesc}>
              Bring your playlists and saved music from Spotify, YouTube Music, and Apple Music into
              your unified Aura vault.
            </Text>

            <View style={styles.emptyActionRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleOpenHub}
                style={styles.connectServiceBtn}
              >
                <LinearGradient
                  colors={['#DAB9FF', '#B78DF5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectServiceGradient}
                >
                  <Ionicons name="link" size={15} color="#0D0D11" style={{ marginRight: 6 }} />
                  <Text style={styles.connectServiceBtnText}>Connect a service</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Overlapping service circles */}
              <View style={styles.overlappingBadges}>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(30, 215, 96, 0.2)', borderColor: 'rgba(30, 215, 96, 0.5)' }]}>
                  <SpotifyIcon size={14} />
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(255, 0, 51, 0.2)', borderColor: 'rgba(255, 0, 51, 0.5)', marginLeft: -8 }]}>
                  <YouTubeMusicIcon size={14} />
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(252, 60, 68, 0.2)', borderColor: 'rgba(252, 60, 68, 0.5)', marginLeft: -8 }]}>
                  <AppleMusicIcon size={14} />
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* ============================================================ */
        /* SUB-STATE 2: POPULATED CONNECTED SERVICES                    */
        /* ============================================================ */
        <View style={styles.populatedWrap}>
          {/* Header */}
          <View style={styles.populatedHeaderRow}>
            <View style={styles.titleRow}>
              <View style={styles.mintDot} />
              <Text style={styles.headerLabel}>CONNECTED LIBRARIES</Text>
              <View style={styles.activeCountBadge}>
                <Text style={styles.activeCountText}>{activeCount} active</Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenHub}
              style={styles.plusConnectBtn}
            >
              <Ionicons name="add" size={16} color="#DAB9FF" />
              <Text style={styles.plusConnectText}>Connect</Text>
            </TouchableOpacity>
          </View>

          {/* Syncing Banner Notice */}
          {syncing && (
            <View style={styles.syncNoticeBanner}>
              <View style={styles.bannerLeft}>
                <ActivityIndicator size="small" color="#DAB9FF" style={{ marginRight: 8 }} />
                <Text style={styles.syncNoticeText}>Syncing playlists...</Text>
              </View>
              <Text style={styles.bannerRightText}>Updated just now</Text>
            </View>
          )}

          {/* Auth Error Banner */}
          {expiredService && (
            <View style={styles.authErrorBanner}>
              <View style={styles.bannerLeft}>
                <Ionicons name="warning-outline" size={18} color="#F87171" style={{ marginRight: 8 }} />
                <View>
                  <Text style={styles.authErrorTitle}>{expiredService.displayName} session expired</Text>
                  <Text style={styles.authErrorSub}>Reconnect to restore imported playlists</Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => reconnectService(expiredService.providerId)}
                style={styles.reconnectBtn}
              >
                <Text style={styles.reconnectBtnText}>Reconnect</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Service Blocks */}
          {connectedServices.map((service) => {
            const meta = PROVIDER_METAS[service.providerId];
            if (!meta) return null;

            return (
              <View key={service.providerId} style={styles.serviceBlock}>
                {/* Service Header Row */}
                <View style={styles.serviceHeaderRow}>
                  <View style={styles.serviceHeaderLeft}>
                    <View
                      style={[
                        styles.serviceMiniIcon,
                        { backgroundColor: meta.brandBgColor },
                      ]}
                    >
                      <ServiceIcon providerId={service.providerId} size={13} />
                    </View>
                    <Text style={styles.serviceBlockName}>{meta.name}</Text>
                    <View style={styles.connectedTag}>
                      <Ionicons name="checkmark-circle" size={13} color="#46F5E0" />
                      <Text style={styles.connectedTagText}>Connected</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => handleOpenManage(service.providerId)}
                    style={styles.manageLink}
                  >
                    <Text style={styles.manageLinkText}>Manage</Text>
                    <Ionicons name="ellipsis-horizontal" size={14} color="#DAB9FF" />
                  </TouchableOpacity>
                </View>

                {/* Playlists Horizontal Scroll */}
                {service.playlists && service.playlists.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.playlistScroll}
                  >
                    {service.playlists.map((playlist) => (
                      <ConnectedPlaylistCard
                        key={playlist.externalId}
                        playlist={playlist}
                        onPress={handlePlaylistPress}
                        onPlay={handlePlaylistPlay}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyPlaylistPlaceholder}>
                    <Text style={styles.emptyPlaceholderText}>
                      No playlists imported yet. Tap Manage to sync.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Service Hub Modal (Stitch Screens 2 & 3) */}
      <ServiceHubModal
        visible={hubVisible}
        onClose={() => setHubVisible(false)}
        onOpenManage={handleOpenManage}
      />

      {/* Manage Service Modal (Stitch Screen 7) */}
      <ManageServiceModal
        providerId={manageProvider}
        visible={manageProvider !== null}
        onClose={() => setManageProvider(null)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 20,
  },
  devSelectorRow: {
    marginBottom: 12,
  },
  devScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  devLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DAB9FF',
    marginRight: 4,
    letterSpacing: 0.5,
  },
  devPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  devPillActive: {
    backgroundColor: '#DAB9FF',
    borderColor: '#DAB9FF',
  },
  devPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  devPillTextActive: {
    color: '#0D0D11',
    fontWeight: '800',
  },

  // Sub-State 1: Empty Banner
  emptyWrap: {},
  emptyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#DAB9FF',
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#A49EB3',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },
  cloudSyncText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(218, 185, 255, 0.85)',
  },
  emptyGlassCard: {
    backgroundColor: 'rgba(32, 31, 41, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.22)',
    padding: 16,
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-black' : 'System',
  },
  emptyCardDesc: {
    fontSize: 12,
    color: '#A49EB3',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectServiceBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#DAB9FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  connectServiceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  connectServiceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D0D11',
    letterSpacing: -0.1,
  },
  overlappingBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sub-State 2: Populated
  populatedWrap: {},
  populatedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mintDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#46F5E0',
    shadowColor: '#46F5E0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  activeCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  plusConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 16,
    backgroundColor: 'rgba(32, 31, 41, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.3)',
  },
  plusConnectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DAB9FF',
  },

  // Banners
  syncNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(218, 185, 255, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(218, 185, 255, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  syncNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DAB9FF',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerRightText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  authErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  authErrorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FECACA',
  },
  authErrorSub: {
    fontSize: 10,
    color: 'rgba(254, 202, 202, 0.75)',
    marginTop: 1,
  },
  reconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  reconnectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FECACA',
  },

  // Service Blocks
  serviceBlock: {
    marginBottom: 16,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  serviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceMiniIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceBlockName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },
  connectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectedTagText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  manageLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DAB9FF',
  },
  playlistScroll: {
    paddingRight: 10,
    paddingBottom: 4,
  },
  emptyPlaylistPlaceholder: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  emptyPlaceholderText: {
    fontSize: 11,
    color: '#A49EB3',
    fontStyle: 'italic',
  },
});

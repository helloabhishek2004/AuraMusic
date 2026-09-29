import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaybackInsets } from '@/src/hooks/use-playback-insets';
import { LiquidAtmosphereBackground } from '@/src/components/ui/LiquidAtmosphereBackground';
import {
  ConnectedPlaylist,
  ConnectedProviderId,
  PROVIDER_METAS,
  providerRegistry,
  trackResolverService,
  useConnectedLibrariesStore,
  ConnectedPlaylistCard,
  ServiceHubModal,
  ManageServiceModal,
  SpotifyIcon,
  YouTubeMusicIcon,
  AppleMusicIcon,
  ServiceIcon,
} from '@/src/features/connected-libraries';
import { useMusic } from '@/src/context/MusicContext';
import { usePlayerStore } from '@/src/features/player/store/player.store';

const { width: SW } = Dimensions.get('window');

const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  bg: '#08080D',
  text: '#FFFFFF',
  muted: 'rgba(170,170,185,0.65)',
  dim: 'rgba(255,255,255,0.25)',
  surface: 'rgba(18,16,26,0.85)',
  surfaceDense: 'rgba(24,20,36,0.92)',
  border: 'rgba(255,255,255,0.08)',
} as const;

export default function ConnectedAppsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bottomPadding } = usePlaybackInsets();
  const music = useMusic();

  const {
    services,
    getActiveServicesCount,
    isAnySyncing,
    getExpiredService,
    connectService,
    syncService,
  } = useConnectedLibrariesStore();

  const [hubVisible, setHubVisible] = useState(false);
  const [manageProvider, setManageProvider] = useState<ConnectedProviderId | null>(null);

  const activeCount = getActiveServicesCount();
  const syncing = isAnySyncing();
  const expiredService = getExpiredService();

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/library');
    }
  }, [router]);

  const handleOpenHub = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHubVisible(true);
  }, []);

  const handleOpenManage = useCallback((id: ConnectedProviderId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setManageProvider(id);
  }, []);

  const isNavigatingRef = useRef(false);

  // Automatically reconcile and enrich playlist track counts if any connected playlist has 0 tracks
  useEffect(() => {
    if (services.spotify?.status === 'connected' && services.spotify.playlists.length > 0) {
      const hasZeroTrackPlaylists = services.spotify.playlists.some(
        (p) => !p.trackCount || p.trackCount === 0
      );
      if (hasZeroTrackPlaylists) {
        syncService('spotify').catch(() => {});
      }
    }
  }, [services.spotify?.status, services.spotify?.playlists, syncService]);

  const handlePlaylistPress = useCallback(
    (playlist: ConnectedPlaylist) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.push({
        pathname: '/playlist/[id]',
        params: { id: playlist.externalId, provider: playlist.providerId },
      });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 800);
    },
    [router]
  );

  const handlePlaylistPlay = useCallback(
    async (playlist: ConnectedPlaylist) => {
      const store = usePlayerStore.getState();
      const isThisActive =
        store.activeContext?.type === 'playlist' &&
        store.activeContext?.id === playlist.externalId;

      if (isThisActive) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        store.isPlaying ? await music.pause() : await music.play();
        return;
      }

      // Check if we have cached resolved tracks first (0ms instantaneous play!)
      const cache = useConnectedLibrariesStore.getState().getCachedPlaylist(playlist.providerId, playlist.externalId);
      if (cache?.resolvedTracks && cache.resolvedTracks.length > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        store.setActiveContext({
          type: 'playlist',
          id: playlist.externalId,
          name: playlist.title,
        });
        await music.setQueue(cache.resolvedTracks, 0, {
          sourceId: playlist.externalId,
          sourceType: 'playlist',
          generatedAt: Date.now(),
        });
        return;
      }

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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            store.setActiveContext({
              type: 'playlist',
              id: playlist.externalId,
              name: playlist.title,
            });
            await music.setQueue(resolved, 0, {
              sourceId: playlist.externalId,
              sourceType: 'playlist',
              generatedAt: Date.now(),
            });
            return;
          }
        }

        Alert.alert(
          playlist.title,
          `No canonical playable matches could be verified for tracks in "${playlist.title}".`,
          [{ text: 'OK' }]
        );
      } catch (err: any) {
        Alert.alert(playlist.title, err?.message || 'Playback setup failed.', [{ text: 'OK' }]);
      }
    },
    [music]
  );

  const renderStatusBadge = (status: string, accountName?: string) => {
    if (status === 'connected') {
      return (
        <View style={[styles.statusPill, styles.statusPillConnected]}>
          <View style={[styles.statusDot, { backgroundColor: '#46f5e0' }]} />
          <Text style={[styles.statusText, { color: '#46f5e0' }]}>
            {accountName ? `Connected · ${accountName}` : 'Connected'}
          </Text>
        </View>
      );
    }
    if (status === 'syncing') {
      return (
        <View style={[styles.statusPill, styles.statusPillSyncing]}>
          <ActivityIndicator size="small" color="#BF5AF2" style={{ marginRight: 6, transform: [{ scale: 0.75 }] }} />
          <Text style={[styles.statusText, { color: '#BF5AF2' }]}>Syncing...</Text>
        </View>
      );
    }
    if (status === 'auth_expired') {
      return (
        <View style={[styles.statusPill, styles.statusPillExpired]}>
          <View style={[styles.statusDot, { backgroundColor: '#F87171' }]} />
          <Text style={[styles.statusText, { color: '#F87171' }]}>Session Expired</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusPill}>
        <View style={[styles.statusDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
        <Text style={styles.statusText}>Not connected</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Signature Liquid Atmospheric Background */}
      <LiquidAtmosphereBackground targetRoute="/connected_apps" />

      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Connected Apps</Text>
          <Text style={styles.headerSubtitle}>Manage your external music libraries</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleOpenHub}
          style={styles.headerAddButton}
        >
          <Ionicons name="add" size={22} color="#DAB9FF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Syncing notice */}
        {syncing && (
          <View style={styles.syncBanner}>
            <ActivityIndicator size="small" color="#46f5e0" style={{ marginRight: 10 }} />
            <Text style={styles.syncBannerText}>Syncing playlists from your connected services...</Text>
          </View>
        )}

        {/* Auth error notice */}
        {expiredService && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handleOpenManage(expiredService.providerId)}
            style={styles.expiredBanner}
          >
            <Ionicons name="warning-outline" size={18} color="#F87171" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.expiredTitle}>{expiredService.displayName} session expired</Text>
              <Text style={styles.expiredSub}>Tap to reconnect and restore imported playlists</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}

        {/* Empty state when 0 services connected */}
        {activeCount === 0 && (
          <View style={styles.emptyCard}>
            <LinearGradient
              colors={['rgba(191,90,242,0.15)', 'rgba(25,22,38,0.85)']}
              style={styles.emptyCardGradient}
            >
              <View style={styles.emptyIconRow}>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(30, 215, 96, 0.2)', borderColor: 'rgba(30, 215, 96, 0.5)' }]}>
                  <SpotifyIcon size={18} />
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(255, 0, 51, 0.2)', borderColor: 'rgba(255, 0, 51, 0.5)', marginLeft: -10 }]}>
                  <YouTubeMusicIcon size={18} />
                </View>
                <View style={[styles.avatarCircle, { backgroundColor: 'rgba(252, 60, 68, 0.2)', borderColor: 'rgba(252, 60, 68, 0.5)', marginLeft: -10 }]}>
                  <AppleMusicIcon size={18} />
                </View>
              </View>

              <Text style={styles.emptyCardTitle}>Connect your music apps</Text>
              <Text style={styles.emptyCardDesc}>
                Bring your playlists and music from your favorite services into AuraMusic.
              </Text>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleOpenHub}
                style={styles.connectAppBtn}
              >
                <LinearGradient
                  colors={['#DAB9FF', '#B78DF5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.connectAppBtnGradient}
                >
                  <Ionicons name="link" size={16} color="#0D0D11" style={{ marginRight: 8 }} />
                  <Text style={styles.connectAppBtnText}>Connect an App</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {/* ── 1. YouTube Music Section ────────────────────────────────────────── */}
        <View style={styles.providerSection}>
          <View style={styles.providerCard}>
            <View style={styles.providerHeader}>
              <View style={[styles.providerIconWrap, { backgroundColor: 'rgba(255, 0, 51, 0.15)', borderColor: 'rgba(255, 0, 51, 0.35)' }]}>
                <YouTubeMusicIcon size={24} />
              </View>

              <View style={styles.providerMeta}>
                <Text style={styles.providerTitle}>YouTube Music</Text>
                {renderStatusBadge(services.ytmusic?.status || 'not_connected', services.ytmusic?.accountName)}
              </View>

              {services.ytmusic?.status === 'connected' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenManage('ytmusic')}
                  style={styles.managePill}
                >
                  <Text style={styles.managePillText}>Manage</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleOpenHub}
                  style={styles.connectPill}
                >
                  <Text style={styles.connectPillText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* User Playlists */}
            {services.ytmusic?.status === 'connected' && (
              <View style={styles.playlistListWrap}>
                <View style={styles.playlistListHeader}>
                  <Text style={styles.playlistSectionTitle}>User Playlists</Text>
                  <Text style={styles.playlistSectionCount}>
                    {services.ytmusic.playlists.length} playlists
                  </Text>
                </View>

                {services.ytmusic.playlists.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.playlistsScroll}
                  >
                    {services.ytmusic.playlists.map((playlist) => (
                      <ConnectedPlaylistCard
                        key={playlist.externalId}
                        playlist={playlist}
                        onPress={handlePlaylistPress}
                        onPlay={handlePlaylistPlay}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyPlaylistsNote}>
                    <Text style={styles.emptyPlaylistsText}>
                      No playlists found in your YouTube account.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── 2. Spotify Section ─────────────────────────────────────────────── */}
        <View style={styles.providerSection}>
          <View style={styles.providerCard}>
            <View style={styles.providerHeader}>
              <View style={[styles.providerIconWrap, { backgroundColor: 'rgba(30, 215, 96, 0.15)', borderColor: 'rgba(30, 215, 96, 0.35)' }]}>
                <SpotifyIcon size={24} />
              </View>

              <View style={styles.providerMeta}>
                <Text style={styles.providerTitle}>Spotify</Text>
                {renderStatusBadge(services.spotify?.status || 'not_connected', services.spotify?.accountName)}
              </View>

              {services.spotify?.status === 'connected' ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleOpenManage('spotify')}
                  style={styles.managePill}
                >
                  <Text style={styles.managePillText}>Manage</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleOpenHub}
                  style={styles.connectPill}
                >
                  <Text style={styles.connectPillText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Spotify Playlists if connected */}
            {services.spotify?.status === 'connected' && services.spotify.playlists.length > 0 && (
              <View style={styles.playlistListWrap}>
                <View style={styles.playlistListHeader}>
                  <Text style={styles.playlistSectionTitle}>Imported Playlists</Text>
                  <Text style={styles.playlistSectionCount}>
                    {services.spotify.playlists.length} playlists
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.playlistsScroll}
                >
                  {services.spotify.playlists.map((playlist) => (
                    <ConnectedPlaylistCard
                      key={playlist.externalId}
                      playlist={playlist}
                      onPress={handlePlaylistPress}
                      onPlay={handlePlaylistPlay}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {/* ── 3. Apple Music Section ─────────────────────────────────────────── */}
        <View style={styles.providerSection}>
          <View style={styles.providerCard}>
            <View style={styles.providerHeader}>
              <View style={[styles.providerIconWrap, { backgroundColor: 'rgba(252, 60, 68, 0.15)', borderColor: 'rgba(252, 60, 68, 0.35)' }]}>
                <AppleMusicIcon size={24} />
              </View>

              <View style={styles.providerMeta}>
                <Text style={styles.providerTitle}>Apple Music</Text>
                <View style={styles.statusPill}>
                  <View style={[styles.statusDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                  <Text style={styles.statusText}>Coming soon</Text>
                </View>
              </View>

              <View style={[styles.connectPill, { opacity: 0.5 }]}>
                <Text style={styles.connectPillText}>Unavailable</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Service Hub Modal (Connection Flows) */}
      <ServiceHubModal
        visible={hubVisible}
        onClose={() => setHubVisible(false)}
        onOpenManage={handleOpenManage}
      />

      {/* Manage Service Modal (Disconnect / Sync / Reconnect) */}
      <ManageServiceModal
        providerId={manageProvider}
        visible={manageProvider !== null}
        onClose={() => setManageProvider(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.muted,
    fontWeight: '500',
    marginTop: 2,
  },
  headerAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(191,90,242,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(70, 245, 224, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(70, 245, 224, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  syncBannerText: {
    color: '#46f5e0',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  expiredTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
  },
  expiredSub: {
    fontSize: 12,
    color: 'rgba(248, 113, 113, 0.8)',
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  emptyCardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyCardDesc: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  connectAppBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  connectAppBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  connectAppBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D11',
  },
  providerSection: {
    marginBottom: 18,
  },
  providerCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  providerMeta: {
    flex: 1,
  },
  providerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillConnected: {
    backgroundColor: 'rgba(70, 245, 224, 0.1)',
  },
  statusPillSyncing: {
    backgroundColor: 'rgba(191, 90, 242, 0.1)',
  },
  statusPillExpired: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  managePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  managePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  connectPill: {
    backgroundColor: 'rgba(191,90,242,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(191,90,242,0.35)',
  },
  connectPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DAB9FF',
  },
  playlistListWrap: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  playlistListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playlistSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playlistSectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  playlistsScroll: {
    gap: 12,
    paddingRight: 12,
  },
  emptyPlaylistsNote: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyPlaylistsText: {
    fontSize: 13,
    color: C.muted,
  },
});

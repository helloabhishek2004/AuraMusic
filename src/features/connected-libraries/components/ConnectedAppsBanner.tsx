import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';
import { SpotifyIcon, YouTubeMusicIcon, AppleMusicIcon } from './ServiceIcons';

interface ConnectedAppsBannerProps {
  onPress: () => void;
}

export const ConnectedAppsBanner = memo(function ConnectedAppsBanner({
  onPress,
}: ConnectedAppsBannerProps) {
  const { getActiveServicesCount, isAnySyncing } = useConnectedLibrariesStore();
  const activeCount = getActiveServicesCount();
  const syncing = isAnySyncing();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={styles.container}
    >
      <LinearGradient
        colors={['rgba(191,90,242,0.12)', 'rgba(25,22,38,0.78)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, activeCount > 0 ? styles.dotActive : styles.dotInactive]} />
            <Text style={styles.sectionTag}>CONNECTED APPS</Text>
            {activeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {syncing ? 'Syncing...' : `${activeCount} connected`}
                </Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
        </View>

        <View style={styles.contentRow}>
          <View style={styles.textCol}>
            <Text style={styles.mainTitle}>
              Spotify · YouTube Music · Apple Music
            </Text>
            <Text style={styles.subTitle}>
              Manage your connected music services
            </Text>
          </View>

          {/* Overlapping provider icon circles */}
          <View style={styles.iconCluster}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(30, 215, 96, 0.18)', borderColor: 'rgba(30, 215, 96, 0.45)' }]}>
              <SpotifyIcon size={16} />
            </View>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255, 0, 51, 0.18)', borderColor: 'rgba(255, 0, 51, 0.45)', marginLeft: -10 }]}>
              <YouTubeMusicIcon size={16} />
            </View>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(252, 60, 68, 0.18)', borderColor: 'rgba(252, 60, 68, 0.45)', marginLeft: -10 }]}>
              <AppleMusicIcon size={16} />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    ...Platform.select({
      android: { elevation: 3 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
    }),
  },
  gradientCard: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(18, 16, 26, 0.88)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#46f5e0',
  },
  dotInactive: {
    backgroundColor: '#BF5AF2',
  },
  sectionTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DAB9FF',
    letterSpacing: 1.2,
  },
  badge: {
    backgroundColor: 'rgba(70, 245, 224, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(70, 245, 224, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#46f5e0',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textCol: {
    flex: 1,
    paddingRight: 12,
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.1,
  },
  subTitle: {
    fontSize: 13,
    color: 'rgba(170, 170, 185, 0.7)',
    fontWeight: '500',
  },
  iconCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});

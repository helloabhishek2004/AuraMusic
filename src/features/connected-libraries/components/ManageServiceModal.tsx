import React, { useCallback, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ConnectedProviderId } from '../types/provider';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';
import { PROVIDER_METAS } from '../providers/base';
import { ServiceIcon } from './ServiceIcons';

interface ManageServiceModalProps {
  providerId: ConnectedProviderId | null;
  visible: boolean;
  onClose: () => void;
}

export function ManageServiceModal({ providerId, visible, onClose }: ManageServiceModalProps) {
  const { services, syncService, reconnectService, disconnectService } =
    useConnectedLibrariesStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  if (!providerId) return null;

  const meta = PROVIDER_METAS[providerId];
  const serviceState = services[providerId];

  const playlistCount = serviceState?.playlists?.length || 0;
  const lastSyncText = serviceState?.lastSyncedAt
    ? 'Just now'
    : 'Never';

  const handleSyncNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsSyncing(true);
    await syncService(providerId);
    setIsSyncing(false);
    onClose();
  };

  const handleReconnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsReconnecting(true);
    const result = await reconnectService(providerId);
    setIsReconnecting(false);

    if (result.success) {
      onClose();
    } else {
      Alert.alert(
        'Reconnect Service',
        result.error || 'Authentication refresh could not be completed.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleConfirmDisconnect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    Alert.alert(
      `Disconnect ${meta.name}?`,
      `This will remove imported ${meta.name} playlists from your Aura vault. Your local music, downloads, and playlists remain untouched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectService(providerId);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.serviceAvatar,
                  { backgroundColor: meta.brandBgColor, borderColor: meta.brandBorderColor },
                ]}
              >
                <ServiceIcon providerId={providerId} size={28} />
              </View>
              <View>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.serviceTitle}>{meta.name}</Text>
                  <View style={styles.connectedBadge}>
                    <Text style={styles.connectedBadgeText}>Connected</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>
                  Last synced: {lastSyncText} · {playlistCount} Playlists
                </Text>
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Actions List */}
          <View style={styles.actionsList}>
            {/* Sync Now */}
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isSyncing}
              onPress={handleSyncNow}
              style={styles.actionCard}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="sync" size={20} color="#DAB9FF" />
                <View>
                  <Text style={styles.actionTitle}>Sync Library Now</Text>
                  <Text style={styles.actionDesc}>Refresh tracks and new playlists</Text>
                </View>
              </View>
              {isSyncing ? (
                <ActivityIndicator size="small" color="#DAB9FF" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
              )}
            </TouchableOpacity>

            {/* Reconnect & Refresh Tokens */}
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={isReconnecting}
              onPress={handleReconnect}
              style={styles.actionCard}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="refresh" size={20} color="#46F5E0" />
                <View>
                  <Text style={styles.actionTitle}>Reconnect & Refresh Tokens</Text>
                  <Text style={styles.actionDesc}>Re-authenticate without losing metadata</Text>
                </View>
              </View>
              {isReconnecting ? (
                <ActivityIndicator size="small" color="#46F5E0" />
              ) : (
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
              )}
            </TouchableOpacity>

            {/* Disconnect Service */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleConfirmDisconnect}
              style={styles.disconnectCard}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="link-outline" size={20} color="#FC3C44" />
                <View>
                  <Text style={[styles.actionTitle, { color: '#FC3C44' }]}>Disconnect Service</Text>
                  <Text style={[styles.actionDesc, { color: 'rgba(252, 60, 68, 0.7)' }]}>
                    Remove imported playlists from AuraMusic
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(252, 60, 68, 0.5)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: 'rgba(20, 19, 27, 0.96)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        }
      : { elevation: 24 }),
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-black' : 'System',
  },
  connectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(70, 245, 224, 0.16)',
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#46F5E0',
  },
  subtitle: {
    fontSize: 11,
    color: '#A49EB3',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsList: {
    gap: 10,
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(32, 31, 41, 0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: 14,
  },
  disconnectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(252, 60, 68, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(252, 60, 68, 0.25)',
    padding: 14,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionDesc: {
    fontSize: 10,
    color: '#A49EB3',
    marginTop: 2,
  },
});

import React, { useState, useCallback } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ConnectedProviderId } from '../types/provider';
import { useConnectedLibrariesStore } from '../store/connected-libraries.store';
import { PROVIDER_METAS } from '../providers/base';
import { ServiceIcon } from './ServiceIcons';

interface ServiceHubModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenManage?: (providerId: ConnectedProviderId) => void;
}

export function ServiceHubModal({ visible, onClose, onOpenManage }: ServiceHubModalProps) {
  const { services, connectService } = useConnectedLibrariesStore();
  const [selectedProvider, setSelectedProvider] = useState<ConnectedProviderId | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleOpenConfirm = useCallback((providerId: ConnectedProviderId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedProvider(providerId);
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setSelectedProvider(null);
  }, []);

  const handleExecuteConnect = useCallback(async () => {
    if (!selectedProvider) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsConnecting(true);

    const result = await connectService(selectedProvider);
    setIsConnecting(false);

    if (result.success) {
      setSelectedProvider(null);
      onClose();
    } else if (result.cancelled) {
      // Clean return on user cancellation or modal dismissal
      setSelectedProvider(null);
    } else {
      Alert.alert(
        `${PROVIDER_METAS[selectedProvider]?.name || 'Service'} Setup`,
        result.error || 'Authentication could not be completed at this time.',
        [{ text: 'OK', onPress: () => setSelectedProvider(null) }]
      );
    }
  }, [selectedProvider, connectService, onClose]);

  const providerList: ConnectedProviderId[] = ['spotify', 'ytmusic', 'applemusic'];

  const renderServiceCard = (id: ConnectedProviderId) => {
    const meta = PROVIDER_METAS[id];
    const serviceState = services[id];
    const isConnected =
      serviceState?.status === 'connected' ||
      serviceState?.status === 'syncing' ||
      serviceState?.status === 'auth_expired';

    return (
      <View key={id} style={styles.serviceCard}>
        <View style={styles.serviceLeft}>
          <View
            style={[
              styles.serviceIconWrap,
              { backgroundColor: meta.brandBgColor, borderColor: meta.brandBorderColor },
            ]}
          >
            <ServiceIcon providerId={id} size={26} />
          </View>
          <View style={styles.serviceMeta}>
            <Text style={styles.serviceName}>{meta.name}</Text>
            <Text style={styles.serviceSubtitle}>{meta.subtitle}</Text>
          </View>
        </View>

        {isConnected ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              onOpenManage?.(id);
            }}
            style={styles.manageBtn}
          >
            <Ionicons name="checkmark" size={13} color="#46F5E0" style={{ marginRight: 3 }} />
            <Text style={styles.manageBtnText}>Connected</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleOpenConfirm(id)}
            style={[
              styles.connectBtn,
              { backgroundColor: meta.brandBgColor, borderColor: meta.brandBorderColor },
            ]}
          >
            <Text style={[styles.connectBtnText, { color: meta.brandColor }]}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const selectedMeta = selectedProvider ? PROVIDER_METAS[selectedProvider] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (selectedProvider) {
          setSelectedProvider(null);
        } else {
          onClose();
        }
      }}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={() => {
            if (selectedProvider) {
              setSelectedProvider(null);
            } else {
              onClose();
            }
          }}
        />

        <View style={styles.sheetContainer}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {selectedProvider && selectedMeta ? (
            /* ============================================================ */
            /* SCREEN 3: SERVICE CONNECTION CONFIRMATION                    */
            /* ============================================================ */
            <View style={styles.confirmContent}>
              <View
                style={[
                  styles.confirmBadge,
                  { backgroundColor: selectedMeta.brandBgColor, borderColor: selectedMeta.brandBorderColor },
                ]}
              >
                <ServiceIcon providerId={selectedProvider} size={36} />
              </View>

              <Text style={styles.confirmTitle}>Connect your {selectedMeta.name} library</Text>
              <Text style={styles.confirmDesc}>
                AuraMusic will securely request read-only access to view your public & saved playlists.
                Your login happens on the official authentication service.
              </Text>

              <View style={styles.perksCard}>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark" size={16} color="#46F5E0" />
                  <Text style={styles.perkText}>View playlists, saved tracks & metadata</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="checkmark" size={16} color="#46F5E0" />
                  <Text style={styles.perkText}>Continuous background sync</Text>
                </View>
                <View style={styles.perkRow}>
                  <Ionicons name="lock-closed" size={15} color="rgba(255,255,255,0.45)" />
                  <Text style={[styles.perkText, { color: 'rgba(255,255,255,0.55)' }]}>
                    No credentials or audio files are stored
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                disabled={isConnecting}
                onPress={handleExecuteConnect}
                style={styles.primaryGradientBtn}
              >
                <LinearGradient
                  colors={['#DAB9FF', '#B78DF5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGradientInner}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#0D0D11" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Continue to Connect</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleCancelConfirm}
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Not now</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ============================================================ */
            /* SCREEN 2: DEDICATED CONNECTED SERVICES HUB                   */
            /* ============================================================ */
            <ScrollView
              contentContainerStyle={styles.hubContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.hubHeaderRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.hubTagRow}>
                    <View style={styles.mintDot} />
                    <Text style={styles.hubTagText}>CONNECTED LIBRARIES</Text>
                  </View>
                  <Text style={styles.hubTitle}>Bring your music to AuraMusic</Text>
                  <Text style={styles.hubDesc}>
                    Connect your favorite streaming services to access all your playlists in one
                    place. No audio files are copied.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={onClose}
                  style={styles.closeCircle}
                >
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.servicesList}>
                {providerList.map(renderServiceCard)}
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={styles.doneBtn}
              >
                <Text style={styles.doneBtnText}>Done managing libraries</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
    maxHeight: '88%',
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
  hubContent: {
    paddingBottom: 16,
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  hubTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  mintDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#46F5E0',
  },
  hubTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#46F5E0',
    letterSpacing: 1.2,
  },
  hubTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'android' ? 'sans-serif-black' : 'System',
    marginTop: 2,
  },
  hubDesc: {
    fontSize: 12,
    color: '#A49EB3',
    lineHeight: 18,
    marginTop: 6,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  servicesList: {
    gap: 12,
    marginBottom: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(32, 31, 41, 0.55)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    padding: 14,
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceMeta: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
  },
  serviceSubtitle: {
    fontSize: 11,
    color: '#A49EB3',
    marginTop: 2,
  },
  connectBtn: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  connectBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(70, 245, 224, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70, 245, 224, 0.28)',
  },
  manageBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#46F5E0',
  },
  doneBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneBtnText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '600',
  },

  // Confirmation styles
  confirmContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  confirmBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-black' : 'System',
  },
  confirmDesc: {
    fontSize: 12,
    color: '#A49EB3',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  perksCard: {
    width: '100%',
    backgroundColor: 'rgba(22, 22, 29, 0.55)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 10,
    marginVertical: 18,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkText: {
    fontSize: 12,
    color: '#E8E5F0',
    fontWeight: '500',
  },
  primaryGradientBtn: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#DAB9FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGradientInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D11',
    letterSpacing: -0.1,
  },
  secondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryBtnText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '600',
  },
});

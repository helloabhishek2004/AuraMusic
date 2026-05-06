import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Pressable,
  Modal,
  Dimensions,
  Linking,
  Platform,
  Alert,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, spacing, styling, colors as baseColors } from '../../src/styles/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SettingSection = ({ title, children, index }: { title: string; children: React.ReactNode, index: number }) => {
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
    <Animated.View style={[
      styles.sectionContainer, 
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <Text style={[styles.sectionTitle, { color: '#8E44AD' }]}>{title.toUpperCase()}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </Animated.View>
  );
};

const CustomSwitch = ({ value, onValueChange, activeColor }: { value: boolean; onValueChange: (v: boolean) => void, activeColor: string }) => {
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
    outputRange: ['#3a3a40', activeColor],
  });

  return (
    <Pressable onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(!value);
    }}>
      <Animated.View style={[styles.switchTrack, { backgroundColor }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
};

const QualityModal = ({ 
  visible, 
  onClose, 
  title, 
  options, 
  selectedOption, 
  onSelect,
  activeColor 
}: { 
  visible: boolean; 
  onClose: () => void; 
  title: string; 
  options: string[]; 
  selectedOption: string; 
  onSelect: (opt: string) => void;
  activeColor: string;
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHandle, { backgroundColor: activeColor + '40' }]} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          {options.map((option) => (
             <TouchableOpacity 
              key={option} 
              style={styles.modalOption} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onSelect(option);
                onClose();
              }}
            >
              <Text style={[
                styles.modalOptionText, 
                selectedOption === option && { color: activeColor, fontWeight: 'bold' }
              ]}>
                {option}
              </Text>
              {selectedOption === option && <Ionicons name="checkmark" size={20} color={activeColor} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}>
            <Text style={styles.modalCloseText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, setAccentColor, accentColor } = useTheme();

  // State
  const [switches, setSwitches] = useState({
    crossfade: true,
    gapless: true,
    normalize: true,
    dataSaver: false,
    wifiOnly: true,
    lockScreenArt: true,
  });

  const [streamingQuality, setStreamingQuality] = useState("Extreme (320kbps)");
  const [downloadQuality, setDownloadQuality] = useState("High (256kbps)");
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(6);
  const [showCrossfadeSlider, setShowCrossfadeSlider] = useState(false);
  const [storageUsed, setStorageUsed] = useState(12.4);
  const [modalType, setModalType] = useState<null | 'streaming' | 'download'>(null);
  const [cacheAcknowledgement, setCacheAcknowledgement] = useState(false);

  const toggleSwitch = (key: keyof typeof switches) => {
    setSwitches(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearCache = () => {
    if (storageUsed <= 0.1) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStorageUsed(prev => Number((prev - 0.5).toFixed(1)));
    setCacheAcknowledgement(true);
    setTimeout(() => setCacheAcknowledgement(false), 2000);
  };

  const openEqualizer = async () => {
    if (Platform.OS === 'android') {
      try {
        await Linking.sendIntent('android.media.action.DISPLAY_AUDIO_EFFECTS');
      } catch (e) {
        Alert.alert("Equalizer", "Your device equalizer could not be opened directly.");
      }
    } else {
      Alert.alert("Equalizer", "System equalizer is managed by iOS settings.");
    }
  };

  // Slider logic
  const SLIDER_WIDTH = SCREEN_WIDTH - 80;
  const pan = useRef(new Animated.Value((6 / 12) * SLIDER_WIDTH)).current;
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        let newValue = gestureState.moveX - 40;
        if (newValue < 0) newValue = 0;
        if (newValue > SLIDER_WIDTH) newValue = SLIDER_WIDTH;
        pan.setValue(newValue);
        const seconds = Math.round((newValue / SLIDER_WIDTH) * 12);
        
        if (seconds !== crossfadeSeconds) {
          Haptics.selectionAsync();
          setCrossfadeSeconds(seconds);
        }
      },
      onPanResponderRelease: () => {}
    })
  ).current;

  const accentColors = ['#B19CD9', '#E57373', '#4DB5A6', '#FFB74D', '#64B5F6'];
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: showCrossfadeSlider ? 1 : 0,
      useNativeDriver: false,
    }).start();
  }, [showCrossfadeSlider]);

  const crossfadeHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} /> 
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingSection title="Audio" index={0}>
          <TouchableOpacity style={styles.settingItem} onPress={() => setModalType('streaming')}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Streaming Quality</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>{streamingQuality}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.on_surface_muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => setModalType('download')}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Download Quality</Text>
              <Text style={[styles.settingItemSubtext, { color: accentColor }]}>{downloadQuality}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.on_surface_muted} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={openEqualizer}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Equalizer</Text>
            </View>
            <MaterialCommunityIcons name="waveform" size={20} color={accentColor} />
          </TouchableOpacity>

          <View>
            <View style={styles.settingItem}>
              <Pressable style={styles.settingItemLeft} onPress={() => setShowCrossfadeSlider(!showCrossfadeSlider)}>
                <Text style={styles.settingItemLabel}>Crossfade</Text>
                <Text style={styles.settingItemSubtext}>{crossfadeSeconds} seconds</Text>
              </Pressable>
              <CustomSwitch 
                value={switches.crossfade} 
                onValueChange={() => toggleSwitch('crossfade')} 
                activeColor={accentColor}
              />
            </View>
            <Animated.View style={[styles.sliderContainer, { height: crossfadeHeight }]}>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderValue}>0s</Text>
                <View style={[styles.sliderTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <Animated.View style={[styles.sliderFill, { width: pan, backgroundColor: accentColor }]} />
                  <Animated.View 
                    {...panResponder.panHandlers}
                    style={[styles.sliderKnob, { transform: [{ translateX: Animated.subtract(pan, 10) }], backgroundColor: '#fff', borderColor: accentColor }]} 
                  />
                </View>
                <Text style={styles.sliderValue}>12s</Text>
              </View>
            </Animated.View>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Gapless Playback</Text>
            </View>
            <CustomSwitch value={switches.gapless} onValueChange={() => toggleSwitch('gapless')} activeColor={accentColor} />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Normalize Volume</Text>
            </View>
            <CustomSwitch value={switches.normalize} onValueChange={() => toggleSwitch('normalize')} activeColor={accentColor} />
          </View>
        </SettingSection>

        <SettingSection title="Data & Storage" index={1}>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Data Saver</Text>
            </View>
            <CustomSwitch value={switches.dataSaver} onValueChange={() => toggleSwitch('dataSaver')} activeColor={accentColor} />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Download over Wi-Fi only</Text>
            </View>
            <CustomSwitch value={switches.wifiOnly} onValueChange={() => toggleSwitch('wifiOnly')} activeColor={accentColor} />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Storage Location</Text>
              <Text style={styles.settingItemSubtext}>{`Internal Storage (${storageUsed.toFixed(1)} GB used)`}</Text>
            </View>
            <MaterialCommunityIcons name="chip" size={24} color={themeColors.on_surface_muted} />
          </View>

          <TouchableOpacity 
            style={[styles.clearCacheBtn, cacheAcknowledgement && { borderColor: '#4caf50', borderWidth: 1 }]} 
            onPress={handleClearCache}
          >
            <LinearGradient
              colors={cacheAcknowledgement ? ['#1b5e20', '#1b5e20'] : ['#422', '#211']}
              style={styles.clearCacheGradient}
            >
              <Text style={[styles.clearCacheText, cacheAcknowledgement && { color: '#81c784' }]}>
                {cacheAcknowledgement ? "Cache Cleared! ✓" : "Clear Cache"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </SettingSection>

        <SettingSection title="Appearance" index={2}>
          <View style={styles.accentColorContainer}>
            <Text style={styles.settingItemLabel}>Accent Color</Text>
            <View style={styles.colorRow}>
              {accentColors.map(color => (
                <TouchableOpacity 
                  key={color} 
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    setAccentColor(color);
                  }}
                  style={[
                    styles.colorCircle, 
                    { backgroundColor: color },
                    accentColor === color && { borderColor: '#fff', borderWidth: 2.5 }
                  ]}
                >
                  {accentColor === color && <View style={styles.innerColorCircle} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Text style={styles.settingItemLabel}>Lock Screen Art</Text>
            </View>
            <CustomSwitch value={switches.lockScreenArt} onValueChange={() => toggleSwitch('lockScreenArt')} activeColor={accentColor} />
          </View>
        </SettingSection>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>AuraMusic</Text>
          <Text style={styles.footerVersion}>Version 1.0.0 (Build 2405)</Text>
        </View>
      </ScrollView>

      <QualityModal 
        visible={modalType === 'streaming'} 
        onClose={() => setModalType(null)}
        title="Streaming Quality"
        options={["Normal (96kbps)", "High (160kbps)", "Extreme (320kbps)"]}
        selectedOption={streamingQuality}
        onSelect={setStreamingQuality}
        activeColor={accentColor}
      />
      <QualityModal 
        visible={modalType === 'download'} 
        onClose={() => setModalType(null)}
        title="Download Quality"
        options={["Normal (96kbps)", "High (160kbps)", "Extreme (256kbps)"]}
        selectedOption={downloadQuality}
        onSelect={setDownloadQuality}
        activeColor={accentColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { padding: spacing.xs },
  headerTitle: { fontSize: 24, fontFamily: typography.headlineFont, color: baseColors.on_surface },
  scrollContent: { paddingHorizontal: spacing.md },
  sectionContainer: { marginTop: spacing.xl },
  sectionTitle: { fontSize: 12, fontFamily: typography.labelFont, marginBottom: spacing.sm, marginLeft: spacing.xs, letterSpacing: 1.5 },
  sectionCard: { backgroundColor: '#1b1b20', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.02)' },
  settingItemLeft: { flex: 1 },
  settingItemLabel: { fontSize: 16, fontFamily: typography.labelFont, color: baseColors.on_surface },
  settingItemSubtext: { fontSize: 12, fontFamily: typography.bodyFont, marginTop: 4 },
  switchTrack: { width: 48, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 2 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  sliderContainer: { overflow: 'hidden', paddingHorizontal: 20, justifyContent: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderValue: { color: baseColors.on_surface_muted, fontSize: 12, width: 30, textAlign: 'center' },
  sliderTrack: { flex: 1, height: 4, borderRadius: 2, position: 'relative' },
  sliderFill: { height: '100%', borderRadius: 2 },
  sliderKnob: { position: 'absolute', top: -8, width: 20, height: 20, borderRadius: 10, borderWidth: 2, zIndex: 10 },
  clearCacheBtn: { margin: 20, borderRadius: 16, overflow: 'hidden' },
  clearCacheGradient: { paddingVertical: 14, alignItems: 'center' },
  clearCacheText: { color: '#ff9999', fontSize: 16, fontFamily: typography.labelFont, fontWeight: 'bold' },
  accentColorContainer: { padding: 20 },
  colorRow: { flexDirection: 'row', marginTop: spacing.md, gap: 12 },
  colorCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  innerColorCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  footer: { marginTop: 60, alignItems: 'center', opacity: 0.6 },
  footerBrand: { fontSize: 20, fontFamily: typography.headlineFont, color: baseColors.on_surface },
  footerVersion: { fontSize: 12, fontFamily: typography.bodyFont, color: baseColors.on_surface_muted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modalContent: { backgroundColor: '#1b1b20', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { alignItems: 'center', marginBottom: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: typography.headlineFont, color: baseColors.on_surface },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  modalOptionText: { fontSize: 16, color: baseColors.on_surface },
  modalCloseBtn: { marginTop: 20, alignItems: 'center', padding: 10 },
  modalCloseText: { color: baseColors.on_surface_muted, letterSpacing: 2, fontSize: 12, fontWeight: 'bold' }
});

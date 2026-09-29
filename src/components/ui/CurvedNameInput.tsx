import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, { Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SW } = Dimensions.get('window');
const INPUT_WIDTH = Math.min(SW - 48, 360);
const INPUT_HEIGHT = 68;

interface CurvedNameInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  autoFocus?: boolean;
}

export const CurvedNameInput = React.memo(({
  value,
  onChangeText,
  onSubmit,
  autoFocus = true,
}: CurvedNameInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus ring animation
  const focusAnim = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1.0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: isFocused ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(glowScale, {
        toValue: isFocused ? 1.02 : 1.0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, focusAnim, glowScale]);

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeText('');
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit();
  };

  return (
    <View style={styles.container}>
      {/* ── Curved Outer Glass Surface with Animated Focus Ring ── */}
      <Animated.View
        style={[
          styles.curvedWrapper,
          {
            transform: [{ scale: glowScale }],
          },
        ]}
      >
        {/* SVG Curved Backdrop & Animated Purple/Lavender Gradient Border */}
        <Svg width={INPUT_WIDTH} height={INPUT_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="focusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#BF5AF2" stopOpacity={isFocused ? 0.95 : 0.28} />
              <Stop offset="50%" stopColor="#9C6BFF" stopOpacity={isFocused ? 0.88 : 0.22} />
              <Stop offset="100%" stopColor="#DAB9FF" stopOpacity={isFocused ? 0.92 : 0.25} />
            </SvgLinearGradient>
            <SvgLinearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#1E1A29" stopOpacity={0.85} />
              <Stop offset="100%" stopColor="#131318" stopOpacity={0.94} />
            </SvgLinearGradient>
          </Defs>

          {/* Background fill */}
          <Rect
            x={1}
            y={1}
            width={INPUT_WIDTH - 2}
            height={INPUT_HEIGHT - 2}
            rx={INPUT_HEIGHT / 2}
            ry={INPUT_HEIGHT / 2}
            fill="url(#bgGrad)"
            stroke="url(#focusGrad)"
            strokeWidth={isFocused ? 2 : 1.2}
          />
        </Svg>

        {/* Inner Content Area */}
        <View style={styles.innerRow}>
          {/* Subtle Lead Avatar Icon */}
          <View style={styles.leadIconBox}>
            <Ionicons
              name="person-outline"
              size={20}
              color={isFocused ? '#DAB9FF' : 'rgba(218, 185, 255, 0.45)'}
            />
          </View>

          {/* Actual Native TextInput */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            placeholder="What should we call you?"
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
            autoFocus={autoFocus}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectionColor="#BF5AF2"
            maxLength={32}
            accessibilityLabel="Your name input"
          />

          {/* Clear button if text exists */}
          {value.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color="rgba(255, 255, 255, 0.45)" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Integrated Floating Curved Submit Control ── */}
      <TouchableOpacity
        onPress={handleSubmit}
        activeOpacity={0.8}
        style={styles.submitBtn}
        accessibilityRole="button"
        accessibilityLabel="Continue to next step"
      >
        <Svg width={180} height={52} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id="submitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#BF5AF2" stopOpacity={value.trim().length > 0 ? 0.95 : 0.65} />
              <Stop offset="100%" stopColor="#7B42F6" stopOpacity={value.trim().length > 0 ? 0.95 : 0.65} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={1}
            y={1}
            width={178}
            height={50}
            rx={25}
            ry={25}
            fill="url(#submitGrad)"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={1}
          />
        </Svg>
        <View style={styles.submitInner}>
          <Text style={styles.submitText}>Continue</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    </View>
  );
});

CurvedNameInput.displayName = 'CurvedNameInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
  },
  curvedWrapper: {
    width: INPUT_WIDTH,
    height: INPUT_HEIGHT,
    borderRadius: INPUT_HEIGHT / 2,
    justifyContent: 'center',
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    height: '100%',
  },
  leadIconBox: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingVertical: 0,
    letterSpacing: -0.2,
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
    }),
  },
  clearBtn: {
    marginLeft: 8,
    padding: 4,
  },
  submitBtn: {
    width: 180,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  submitInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassSurface } from '@/src/components/ui/GlassSurface';
import { PressScale } from '@/src/components/ui/press-scale';

interface OnboardingGlassButtonProps {
  onPress: () => void;
  variant?: 'circleArrow' | 'actionCard' | 'pill' | 'secondaryRow';
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPrimary?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const OnboardingGlassButton = React.memo(({
  onPress,
  variant = 'circleArrow',
  title = 'Continue',
  subtitle,
  icon,
  isPrimary = true,
  disabled = false,
  style,
  accessibilityLabel,
}: OnboardingGlassButtonProps) => {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(
      isPrimary ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
    onPress();
  };

  // ── VARIANT 1: Floating Circular Glass Arrow (Screen 01, 02, 03) ──
  if (variant === 'circleArrow') {
    return (
      <PressScale scaleTo={0.91} wrapperStyle={[styles.circleWrapper, style]}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.82}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || 'Continue'}
          style={styles.circlePressable}
        >
          <GlassSurface
            width={64}
            height={64}
            borderRadius={32}
            blur={40}
            opacity={0.42}
            contentStyle={styles.circleGlassContent}
          >
            {/* Active Accent Glow Overlay */}
            <LinearGradient
              colors={['rgba(191, 90, 242, 0.35)', 'rgba(155, 56, 218, 0.20)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Glowing Crisp Arrow */}
            <Ionicons
              name="arrow-forward"
              size={24}
              color="#FFFFFF"
              style={styles.circleIcon}
            />
          </GlassSurface>
        </TouchableOpacity>
      </PressScale>
    );
  }

  // ── VARIANT 2: iOS-Like Action Cards ──
  if (variant === 'actionCard') {
    // If secondary (e.g. Look for Backups), render as a refined, lower-prominence iOS accessory row
    if (!isPrimary) {
      const cardIcon = icon || 'cloud-download-outline';
      return (
        <PressScale scaleTo={0.98} wrapperStyle={[styles.secondaryRowWrapper, style]}>
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.75}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            style={styles.secondaryRowBtn}
          >
            <View style={styles.secondaryRowContent}>
              <View style={styles.secondaryRowIconBox}>
                <Ionicons
                  name={cardIcon}
                  size={18}
                  color="rgba(255, 255, 255, 0.6)"
                />
              </View>
              <View style={styles.secondaryRowTextBlock}>
                <Text style={styles.secondaryRowTitle}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.secondaryRowSubtitle}>{subtitle}</Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255, 255, 255, 0.35)"
              />
            </View>
          </TouchableOpacity>
        </PressScale>
      );
    }

    // PRIMARY HERO CARD: "Get Started" — Rich Apple Music Grade Hero Banner
    const cardIcon = icon || 'sparkles';
    return (
      <PressScale scaleTo={0.97} wrapperStyle={[styles.cardWrapper, style]}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || title}
          style={[styles.cardBtn, styles.primaryCard]}
        >
          {/* Dynamic Frosted Gradient Fill */}
          <LinearGradient
            colors={['rgba(191, 90, 242, 0.32)', 'rgba(123, 66, 246, 0.16)', 'rgba(20, 16, 32, 0.92)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Frosted Glass Specular Border with top highlight */}
          <View style={[styles.cardBorder, styles.primaryBorder]} />
          <View style={styles.specularTopEdge} />

          {/* Left Vibrant Squircle Icon Badge */}
          <View style={[styles.cardIconSquircle, styles.primaryIconSquircle]}>
            <LinearGradient
              colors={['#BF5AF2', '#7B42F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name={cardIcon}
              size={22}
              color="#FFFFFF"
            />
          </View>

          {/* Center Text Block */}
          <View style={styles.cardTextBlock}>
            <Text style={[styles.cardTitle, styles.primaryCardTitle]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            ) : null}
          </View>

          {/* Right Floating Arrow Pill */}
          <View style={[styles.arrowBubble, styles.primaryArrowBubble]}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>
      </PressScale>
    );
  }

  // ── VARIANT 3: Floating Primary Pill Control (Screen 06, 07, 08) ──
  return (
    <PressScale scaleTo={0.95} wrapperStyle={[styles.pillWrapper, style]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.82}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        style={styles.pillBtn}
      >
        <LinearGradient
          colors={
            isPrimary
              ? ['#BF5AF2', '#7B42F6']
              : ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.06)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.pillBorder} />

        <View style={styles.pillContent}>
          <Text style={styles.pillTitle}>{title}</Text>
          <Ionicons name="arrow-forward" size={17} color="#FFF" style={{ marginLeft: 6 }} />
        </View>
      </TouchableOpacity>
    </PressScale>
  );
});

OnboardingGlassButton.displayName = 'OnboardingGlassButton';

const styles = StyleSheet.create({
  // Circle Arrow
  circleWrapper: {
    alignSelf: 'center',
  },
  circlePressable: {
    borderRadius: 32,
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  circleGlassContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleIcon: {
    marginLeft: 2,
  },

  // Primary Hero Action Card ("Get Started")
  cardWrapper: {
    width: '100%',
    marginVertical: 6,
  },
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  primaryCard: {
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    pointerEvents: 'none',
  },
  primaryBorder: {
    borderColor: 'rgba(191, 90, 242, 0.45)',
  },
  specularTopEdge: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  cardIconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    overflow: 'hidden',
  },
  primaryIconSquircle: {
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTextBlock: {
    flex: 1,
    paddingRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  primaryCardTitle: {
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.65)',
    marginTop: 3,
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  arrowBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryArrowBubble: {
    backgroundColor: 'rgba(191, 90, 242, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Secondary Low-Importance Row ("Look for Backups")
  secondaryRowWrapper: {
    width: '100%',
    marginTop: 10,
  },
  secondaryRowBtn: {
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  secondaryRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  secondaryRowIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  secondaryRowTextBlock: {
    flex: 1,
  },
  secondaryRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: -0.1,
  },
  secondaryRowSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.42)',
    marginTop: 1,
  },

  // Pill
  pillWrapper: {
    width: '100%',
  },
  pillBtn: {
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#BF5AF2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 5,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});

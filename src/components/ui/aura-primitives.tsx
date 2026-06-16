import React, { memo } from 'react';
import { StyleProp, StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LiquidGlass } from '@/src/components/ui/liquid-glass';
import { PressScale } from '@/src/components/ui/press-scale';
import { glass, palette, radius, spacing, typography } from '@/src/design/tokens';
import { useReducedMotionPreference } from '@/src/hooks/use-accessibility-preferences';
import Animated, { FadeInUp } from 'react-native-reanimated';

type AuraTextProps = TextProps & {
  variant?: keyof typeof typography;
  muted?: boolean;
};

function AuraTextComponent({ variant = 'body', muted = false, style, ...props }: AuraTextProps) {
  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={1.35}
      {...props}
      style={[typography[variant], muted && styles.mutedText, style]}
    />
  );
}

export const AuraText = memo(AuraTextComponent);

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

function SectionHeaderComponent({ title, actionLabel, onActionPress, style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <AuraText variant="headline" style={styles.sectionTitle}>{title}</AuraText>
      {!!actionLabel && (
        <PressScale
          scaleTo={0.94}
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.sectionAction}
        >
          <AuraText variant="caption" style={styles.sectionActionText}>{actionLabel}</AuraText>
          <Ionicons name="chevron-forward" size={14} color={palette.primary} />
        </PressScale>
      )}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderComponent);

type MotionRevealProps = {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

function MotionRevealComponent({ children, delay = 0, style }: MotionRevealProps) {
  const reduceMotion = useReducedMotionPreference();

  if (reduceMotion) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(delay).duration(400)} 
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export const MotionReveal = memo(MotionRevealComponent);

import { DownloadButton } from './download-button';
import { PlayerTrack } from '@/src/features/player/types/player';
import { AuraArtwork } from './aura-artwork';

type MediaListItemProps = {
  title: string;
  subtitle: string;
  image: string;
  meta?: string;
  active?: boolean;
  onPress?: () => void;
  onSubtitlePress?: () => void;
  rightIcon?: React.ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  track?: PlayerTrack;
  downloadable?: boolean;
};

function MediaListItemComponent({
  title,
  subtitle,
  image,
  meta,
  active,
  onPress,
  onSubtitlePress,
  rightIcon = 'ellipsis-vertical',
  accessibilityLabel,
  style,
  track,
  downloadable = false,
}: MediaListItemProps) {
  const accent = active ? palette.primary : palette.border;

  return (
    <PressScale
      scaleTo={0.975}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}, ${subtitle}`}
      wrapperStyle={style}
      style={styles.mediaPress}
    >
      <LiquidGlass
        dense={active}
        intensity={active ? glass.denseBlur : glass.surfaceBlur}
        accentColor={palette.primary}
        accentOpacity={active ? 0.08 : 0}
        borderRadius={radius.md}
        style={[styles.mediaGlass, active && styles.mediaGlassActive]}
        contentStyle={styles.mediaContent}
      >
        <AuraArtwork 
          source={image} 
          entityName={title}
          style={styles.mediaArt} 
          contentFit="cover" 
          transition={160}
          cachePolicy="memory-disk"
        />
        <View style={styles.mediaCopy}>
          <AuraText variant="headline" numberOfLines={1} style={[styles.mediaTitle, active && styles.activeText]}>
            {title}
          </AuraText>
          <PressScale
            disabled={!onSubtitlePress}
            scaleTo={0.98}
            onPress={onSubtitlePress}
            accessibilityRole={onSubtitlePress ? 'button' : undefined}
            accessibilityLabel={onSubtitlePress ? `Open ${subtitle}` : undefined}
          >
            <AuraText variant="caption" numberOfLines={1} style={styles.mediaSubtitle}>
              {subtitle}
            </AuraText>
          </PressScale>
        </View>
        {!!meta && <AuraText variant="caption" style={styles.mediaMeta}>{meta}</AuraText>}
        <View style={[styles.mediaIcon, { borderColor: accent }]}>
          {downloadable && track ? (
            <DownloadButton track={track} size={18} color={active ? palette.primary : palette.inkDim} />
          ) : (
            <Ionicons name={rightIcon} size={17} color={active ? palette.primary : palette.inkDim} />
          )}
        </View>
      </LiquidGlass>
    </PressScale>
  );
}

export const MediaListItem = memo(MediaListItemComponent);

export function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeleton, style]} />;
}

const styles = StyleSheet.create({
  mutedText: {
    color: palette.inkDim,
  },
  sectionHeader: {
    minHeight: 34,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    flex: 1,
  },
  sectionAction: {
    minHeight: 34,
    minWidth: 44,
    paddingLeft: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  sectionActionText: {
    color: palette.primary,
  },
  mediaPress: {
    minHeight: 70,
  },
  mediaGlass: {
    borderColor: palette.border,
  },
  mediaGlassActive: {
    borderColor: 'rgba(191,90,242,0.28)',
  },
  mediaContent: {
    minHeight: 70,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mediaArt: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: palette.backgroundRaised,
  },
  mediaCopy: {
    flex: 1,
    minWidth: 0,
  },
  mediaTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  activeText: {
    color: palette.primary,
  },
  mediaSubtitle: {
    marginTop: 2,
  },
  mediaMeta: {
    minWidth: 38,
    textAlign: 'right',
  },
  mediaIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  skeleton: {
    minHeight: 16,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

import React, { memo, useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, Text, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { 
  isGeneratedArtwork, 
  parseGeneratedArtwork, 
  getDeterministicGradient, 
  getInitials 
} from '@/src/features/player/utils/artwork-resolver';
import { palette, radius } from '@/src/design/tokens';

export type AuraArtworkProps = Omit<ImageProps, 'source'> & {
  source?: string | { uri: string } | null;
  entityName?: string;
  entityType?: 'song' | 'artist' | 'album' | 'playlist';
  fallbackIcon?: keyof typeof Ionicons.prototype.props.name;
  borderRadius?: number;
};

const AuraArtworkComponent = ({
  source,
  entityName,
  entityType = 'song',
  fallbackIcon,
  borderRadius = radius.md,
  style,
  contentFit = 'cover',
  transition = 200,
  cachePolicy = 'memory-disk',
  ...props
}: AuraArtworkProps) => {
  const initialUri = typeof source === 'string' ? source : source?.uri;
  const [imageFailed, setImageFailed] = useState(false);

  // [ARTWORK TRACE] Reset failure state if source changes
  useEffect(() => {
    setImageFailed(false);
  }, [initialUri]);

  const uri = imageFailed ? null : initialUri;

  const generated = useMemo(() => {
    if (!uri || isGeneratedArtwork(uri)) {
      const parsed = uri ? parseGeneratedArtwork(uri) : null;
      const name = parsed?.name || entityName || 'A';
      const type = parsed?.type || entityType;
      const colors = getDeterministicGradient(name);
      const initials = getInitials(name);
      
      // [ARTWORK TRACE] Logging generated artwork usage
      if (__DEV__) {
        console.log(`[ARTWORK TRACE] type=${type} name="${name}" input="${initialUri}" output="aura://generated"`);
      }
      
      return { name, type, colors, initials };
    }
    
    // [ARTWORK TRACE] Logging real artwork usage
    if (__DEV__) {
      console.log(`[ARTWORK TRACE] type=${entityType} name="${entityName}" input="${initialUri}" output="${uri}"`);
    }
    
    return null;
  }, [uri, initialUri, entityName, entityType]);

  const containerStyle = useMemo(() => [
    styles.container,
    { borderRadius },
    style as any,
  ], [borderRadius, style]);

  // ── CASE 1: Valid Remote / Local Artwork ──────────────────────────────────
  if (uri && !isGeneratedArtwork(uri)) {
    return (
      <Image
        {...props}
        source={{ uri }}
        style={containerStyle}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        onError={() => {
          if (__DEV__) {
            console.log(`[ARTWORK TRACE ERROR] Image load failed for: ${uri}`);
          }
          setImageFailed(true);
        }}
      />
    );
  }

  // ── CASE 2: Generated Fallback (Initials + Gradient) ───────────────────────
  if (generated) {
    const isArtist = generated.type === 'artist';
    const isSmall = (style as any)?.width < 60;

    return (
      <View style={containerStyle}>
        <LinearGradient
          colors={generated.colors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.initialsContainer}>
          {fallbackIcon ? (
            <Ionicons name={fallbackIcon as any} size={isSmall ? 18 : 32} color="rgba(255,255,255,0.8)" />
          ) : (
            <Text style={[
              styles.initialsText, 
              { fontSize: isSmall ? 14 : 28 },
              isArtist && styles.artistInitials
            ]}>
              {generated.initials}
            </Text>
          )}
        </View>
        
        {/* Subtle glass overlay for depth */}
        <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none" />
      </View>
    );
  }

  // ── CASE 3: Absolute Fallback (Should rarely happen) ───────────────────────
  if (__DEV__) {
    console.log(`[ARTWORK TRACE ERROR] Empty output returned for: ${entityName}`);
  }
  return (
    <View style={[containerStyle, styles.absoluteFallback]}>
      <Ionicons name="musical-note" size={24} color="rgba(255,255,255,0.2)" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.backgroundRaised,
    overflow: 'hidden',
  },
  initialsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  artistInitials: {
    fontStyle: 'italic',
  },
  overlay: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  absoluteFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  }
});

export const AuraArtwork = memo(AuraArtworkComponent);

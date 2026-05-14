import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { usePlayerStore } from '../store/player.store';
import { PlayerTrack } from '../types/player';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SPRING_CONFIG = { damping: 20, stiffness: 150, mass: 1 };

interface QueueItemProps {
  item: PlayerTrack;
  isCurrent: boolean;
  onPress: () => void;
  accentColor: string;
}

const QueueItem = React.memo(({ item, isCurrent, onPress, accentColor }: QueueItemProps) => {
  return (
    <TouchableOpacity
      style={[styles.itemContainer, isCurrent && styles.itemCurrent]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemArtContainer}>
        <Image
          source={{ uri: item.art }}
          style={styles.itemArt}
          contentFit="cover"
          transition={200}
        />
        {isCurrent && (
          <View style={[styles.playingIndicator, { backgroundColor: accentColor }]}>
            <Ionicons name="play" size={12} color="#FFF" />
          </View>
        )}
      </View>
      <View style={styles.itemMeta}>
        <Text
          style={[styles.itemTitle, isCurrent && { color: accentColor }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={styles.itemArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <TouchableOpacity style={styles.itemActions}>
        <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

interface QueueSheetProps {
  isVisible: boolean;
  onClose: () => void;
  accentColor: string;
}

export const QueueSheet = ({ isVisible, onClose, accentColor }: QueueSheetProps) => {
  const insets = useSafeAreaInsets();
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const setTrack = usePlayerStore((s) => s.setTrack);

  const handleTrackPress = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const track = queue[index];
    if (track) {
      // Logic to play from queue
      // In usePlayerStore, we might need a jumpTo action or similar
      // For now, we'll just set the track and update currentIndex
      usePlayerStore.setState({ currentIndex: index });
      setTrack(track);
    }
  }, [queue, setTrack]);

  const renderItem = useCallback(({ item, index }: { item: PlayerTrack; index: number }) => {
    return (
      <QueueItem
        item={item}
        isCurrent={index === currentIndex}
        onPress={() => handleTrackPress(index)}
        accentColor={accentColor}
      />
    );
  }, [currentIndex, accentColor, handleTrackPress]);

  const upcomingQueue = useMemo(() => {
    return queue.slice(currentIndex + 1);
  }, [queue, currentIndex]);

  const sheetStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(isVisible ? 0 : SCREEN_HEIGHT, SPRING_CONFIG),
        },
      ],
    };
  });

  if (!isVisible && Platform.OS === 'android') return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]} pointerEvents={isVisible ? 'auto' : 'none'}>
      {isVisible && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Next Up</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <FlashList
            data={queue}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            estimatedItemSize={72}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <Text style={styles.listSectionTitle}>Currently Playing</Text>
              </View>
            )}
            extraData={currentIndex}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.75,
    backgroundColor: 'rgba(20,20,25,0.95)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  listHeader: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  listSectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginVertical: 2,
  },
  itemCurrent: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  itemArtContainer: {
    position: 'relative',
  },
  itemArt: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  playingIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#141419',
  },
  itemMeta: {
    flex: 1,
    marginLeft: 16,
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  itemArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  itemActions: {
    padding: 8,
  },
});

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
   View,
   Text,
   StyleSheet,
   ScrollView,
   TouchableOpacity,
   TextInput,
   Animated,
   StatusBar,
   Dimensions,
   Platform,
   Alert,
   Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { usePlaylistStore } from '@/src/features/playlist/store/playlist.store';
import { useDownloadStore } from '@/src/features/download/store/download.store';
import type { PlayerTrack } from '@/src/features/player/types/player';
import { musicService } from '@/src/services/api/music';

const { width: SW, height: SH } = Dimensions.get('window');
const isTablet = SW >= 768;
const PAD = isTablet ? 32 : 24;

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
   primary: '#BF5AF2',
   primaryMid: '#9B38DA',
   primaryDp: '#7B2FBE',
   accent: '#46f5e0',
   bg: '#0D0D12',
   surface: 'rgba(22,22,30,0.80)',
   border: 'rgba(255,255,255,0.09)',
   text: '#FFFFFF',
   muted: 'rgba(200,192,215,0.70)',
   dim: 'rgba(170,160,190,0.45)',
   inputBg: '#FFFFFF',
   inputText: '#131318',
   placeholder: 'rgba(100,95,115,0.90)',
};

const SP = { tension: 60, friction: 9 };
const PP = { tension: 200, friction: 8 };

const h2r = (hex: string, a: number) => {
   const r = parseInt(hex.slice(1, 3), 16);
   const g = parseInt(hex.slice(3, 5), 16);
   const b = parseInt(hex.slice(5, 7), 16);
   return `rgba(${r},${g},${b},${a})`;
};

import { getTrackArtwork, getArtworkUrl } from '@/src/features/player/utils/track-identity';
import { resolveArtwork } from '@/src/features/player/utils/artwork-resolver';
import { AuraArtwork } from '@/src/components/ui/aura-artwork';
import AnimatedReanimated, { FadeInUp } from 'react-native-reanimated';

// ── ID generator ─────────────────────────────────────────────────────────────
function generatePlaylistId(): string {
   return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const MOODS = ['#Chill', '#Workout', '#Focus', '#Sleep', '#Party'];


// ── 4-Layer Liquid Glass ──────────────────────────────────────────────────────
const Glass = ({ children, style, r = 20, blur = 60, accent = false }: any) => (
   <View style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
      {/* L2 specular top */}
      <View style={{ position: 'absolute', top: 0, left: r * 0.5, right: r * 0.5, height: 1.5, backgroundColor: 'rgba(255,255,255,0.22)', zIndex: 8 }} />
      {/* L2 specular left strip */}
      <View style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2.5, backgroundColor: 'rgba(255,255,255,0.13)', transform: [{ skewX: '-8deg' }], zIndex: 8 }} />
      {/* optional accent tint */}
      {accent && <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, backgroundColor: h2r(C.primary, 0.07) }} />}
      {/* L4 refraction */}
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.025)' }} />
      {children}
   </View>
);

// ── Materialise entrance ──────────────────────────────────────────────────────
const Mat = ({ children, delay = 0, style }: any) => {
   return (
      <AnimatedReanimated.View 
         entering={FadeInUp.delay(delay).duration(400)} 
         style={style}
      >
         {children}
      </AnimatedReanimated.View>
   );
};

// ── Press scale hook ──────────────────────────────────────────────────────────
const useP = () => {
   const sc = useRef(new Animated.Value(1)).current;
   return {
      sc,
      onIn: () => Animated.spring(sc, { toValue: 0.88, ...PP, useNativeDriver: true }).start(),
      onOut: () => Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }).start(),
   };
};

// ── Track row (add/remove) ────────────────────────────────────────────────────
const MoodChip = ({ item, active, onPress }: { item: string; active: boolean; onPress: () => void }) => {
   const mp = useP();

   return (
      <Animated.View style={{ transform: [{ scale: mp.sc }] }}>
         <TouchableOpacity
            onPress={() => {
               onPress();
               Haptics.selectionAsync();
            }}
            onPressIn={mp.onIn}
            onPressOut={mp.onOut}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={`Set mood to ${item.replace('#', '')}`}
            accessibilityState={{ selected: active }}
         >
            <Glass style={[s.moodTag, active && s.moodTagActive]} r={18} blur={40} accent={active}>
               {active && (
                  <LinearGradient
                     colors={[h2r(C.primary, 0.18), h2r(C.primaryMid, 0.10)]}
                     style={StyleSheet.absoluteFill}
                  />
               )}
               <Text style={[s.moodText, active && s.moodTextActive]}>{item}</Text>
            </Glass>
         </TouchableOpacity>
      </Animated.View>
   );
};

const TrackRow = ({ track, added, onToggle }: any) => {
   const p = useP();
   const sc = useRef(new Animated.Value(1)).current;
   const bg = useRef(new Animated.Value(0)).current;

   const toggle = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // pulse icon
      Animated.sequence([
         Animated.spring(sc, { toValue: 0.7, ...PP, useNativeDriver: true }),
         Animated.spring(sc, { toValue: 1.0, ...PP, useNativeDriver: true }),
      ]).start();
      Animated.timing(bg, { toValue: added ? 0 : 1, duration: 250, useNativeDriver: false }).start();
      onToggle(track);
   };

   const btnBg = bg.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.07)', h2r(C.primary, 0.20)] });
   const btnBorder = bg.interpolate({ inputRange: [0, 1], outputRange: [C.border, h2r(C.primary, 0.50)] });

   return (
      <Animated.View style={{ transform: [{ scale: p.sc }] }}>
         <Glass style={s.trackItem} r={20} blur={55}>
            <TouchableOpacity
               style={s.trackInner}
               onPressIn={p.onIn} onPressOut={p.onOut}
               activeOpacity={1}
            >
               <AuraArtwork 
                  source={resolveArtwork(track, 'card')} 
                  entityName={track.title}
                  entityType="song"
                  style={s.trackArt} 
                  contentFit="cover" 
                  transition={200}
                  cachePolicy="memory-disk"
                  borderRadius={12}
               />
               <View style={s.trackMeta}>
                  <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={s.trackArtist} numberOfLines={1}>{track.artist}</Text>
               </View>
               {/* + / ✓ button */}
               <TouchableOpacity onPress={toggle} activeOpacity={1} style={s.addBtnOuter}>
                  <Animated.View style={[s.addBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}>
                     <Animated.View style={{ transform: [{ scale: sc }] }}>
                        <Ionicons
                           name={added ? 'checkmark' : 'add'}
                           size={20}
                           color={added ? C.primary : C.text}
                        />
                     </Animated.View>
                  </Animated.View>
               </TouchableOpacity>
            </TouchableOpacity>
         </Glass>
      </Animated.View>
   );
};

// ── Cover art placeholder ────────────────────────────────────────────────────
const CoverArt = ({ addedTracks, allSongs }: { addedTracks: string[]; allSongs: PlayerTrack[] }) => {
   const pulse = useRef(new Animated.Value(1)).current;
   useEffect(() => {
      Animated.loop(Animated.sequence([
         Animated.timing(pulse, { toValue: 1.05, duration: 2200, useNativeDriver: true }),
         Animated.timing(pulse, { toValue: 1.0, duration: 2200, useNativeDriver: true }),
      ])).start();
   }, []);

   const firstFour = addedTracks.slice(0, 4);
   
   // Combine all downloaded tracks and online tracks for the cover art
   const storeSongs = useMemo(() => Object.values(useDownloadStore.getState().downloadedTracks) as PlayerTrack[], []);
   const displayTracks = useMemo(() => {
      // Find track objects in allSongs first, fallback to a dummy if missing
      return firstFour.map(id => storeSongs.find(t => t.id === id) || allSongs.find(t => t.id === id) || { id, art: '' });
   }, [firstFour, storeSongs, allSongs]);

   return (
      <Animated.View style={[s.coverOuter, { transform: [{ scale: pulse }] }]}>
         <Glass style={s.coverBox} r={28} blur={40}>
            {/* bg gradient inside art */}
            <LinearGradient
               colors={[h2r(C.primaryDp, 0.55), h2r(C.primaryMid, 0.30), 'transparent']}
               style={StyleSheet.absoluteFill}
            />
            {firstFour.length === 0 ? (
               <View style={s.coverEmpty}>
                  <Ionicons name="musical-note" size={64} color={h2r(C.primary, 0.35)} />
                  <Text style={s.coverHint}>Add tracks to{'\n'}preview cover</Text>
               </View>
            ) : (
               <View style={s.coverGrid}>
                  {displayTracks.map((t: any, i: number) => (
                     <AuraArtwork 
                        key={`${t.id}-${i}`} 
                        source={resolveArtwork(t, 'card')} 
                        entityName={t.title || 'Track'}
                        entityType="song"
                        style={[s.coverGridImg, firstFour.length === 1 && { width: 180, height: 180, borderRadius: 20 }]} 
                        contentFit="cover" 
                        cachePolicy="memory-disk" 
                     />
                  ))}
               </View>
            )}
            {/* refraction ring */}
            <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }} />
            {/* top specular arc */}
            <View style={{ position: 'absolute', top: 0, left: 28, right: 28, height: 1.5, backgroundColor: 'rgba(255,255,255,0.24)' }} />
         </Glass>
         <View style={s.coverGlow} />
      </Animated.View>
   );
};


// ── MAIN SCREEN ───────────────────────────────────────────────────────────────
export default function CreatePlaylistScreen() {
   const insets = useSafeAreaInsets();
   const router = useRouter();

   const [name, setName] = useState('');
   const [mood, setMood] = useState('#Chill');
   const [query, setQuery] = useState('');
   const [added, setAdded] = useState<string[]>([]);
   const [selectedOnlineTracks, setSelectedOnlineTracks] = useState<Record<string, PlayerTrack>>({});
   const [showAll, setShowAll] = useState(false);

   // Auto-focus name input on mount for premium UX
   const nameInputRef = useRef<TextInput>(null);
   useEffect(() => {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
   }, []);

   // Real downloaded tracks as catalogue source
   const downloadedTracks = useDownloadStore(s => s.downloadedTracks);
   const allSongs = useMemo(
      () => Object.values(downloadedTracks) as PlayerTrack[],
      [downloadedTracks]
   );

   // Animated bg
   const bgP = useRef(new Animated.Value(0)).current;
   useEffect(() => {
      Animated.loop(Animated.sequence([
         Animated.timing(bgP, { toValue: 1, duration: 7000, useNativeDriver: false }),
         Animated.timing(bgP, { toValue: 2, duration: 7000, useNativeDriver: false }),
         Animated.timing(bgP, { toValue: 0, duration: 7000, useNativeDriver: false }),
      ])).start();
   }, []);
   const b1Op = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.14, 0.22, 0.10] });
   const b2Op = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.08, 0.14, 0.18] });
   const b1T  = bgP.interpolate({ inputRange: [0, 1, 2], outputRange: ['-5%', '10%', '-8%'] });

   // Filter from real downloaded tracks
   const filtered = useMemo(() => {
      if (allSongs.length === 0) return [];
      if (!query.trim()) return showAll ? allSongs : allSongs.slice(0, 5);
      return allSongs.filter(t =>
         t.title.toLowerCase().includes(query.toLowerCase()) ||
         t.artist.toLowerCase().includes(query.toLowerCase())
      );
   }, [allSongs, query, showAll]);

   // Online search integration
   const [onlineResults, setOnlineResults] = useState<PlayerTrack[]>([]);
   const [isSearching, setIsSearching] = useState(false);
   const abortControllerRef = useRef<AbortController | null>(null);

   const allSongsRef = useRef(allSongs);
   useEffect(() => {
      allSongsRef.current = allSongs;
   }, [allSongs]);

   useEffect(() => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
         setOnlineResults([]);
         setIsSearching(false);
         if (abortControllerRef.current) {
            abortControllerRef.current.abort();
         }
         return;
      }

      if (abortControllerRef.current) {
         abortControllerRef.current.abort();
      }
      const ac = new AbortController();
      abortControllerRef.current = ac;

      const timer = setTimeout(async () => {
         setIsSearching(true);
         try {
            const results = await musicService.searchSongs(query);
            if (!ac.signal.aborted) {
               const downloadedIds = new Set(allSongsRef.current.map(s => s.id));
               const newTracks: PlayerTrack[] = results
                  .filter(r => !downloadedIds.has(r.id))
                  .slice(0, 5)
                  .map(r => ({
                     id: r.id,
                     title: r.title,
                     artist: r.artist || 'Unknown',
                     art: r.art || '',
                     url: '',
                     albumId: r.albumId,
                     album: r.album,
                     source: r.source || 'ytmusic',
                     duration: typeof r.duration === 'string' && r.duration.includes(':')
                        ? r.duration.split(':').reduce((acc, time) => {
                             const parsed = parseInt(time, 10);
                             return isNaN(parsed) ? acc : (60 * acc) + parsed;
                          }, 0) * 1000
                        : 0,
                     isLocal: false
                  }));
               setOnlineResults(newTracks);
            }
         } catch (e: any) {
            if (e.name !== 'AbortError' && e.name !== 'CanceledError') {
               console.warn('[Online Search] Failed:', e);
            }
         } finally {
            if (!ac.signal.aborted) {
               setIsSearching(false);
            }
         }
      }, 400);

      return () => {
         clearTimeout(timer);
      };
   }, [query, allSongs]);

   const toggleAdded = useCallback((track: PlayerTrack) => {
      setAdded(prev => {
         const isAdding = !prev.includes(track.id);
         return isAdding ? [...prev, track.id] : prev.filter(x => x !== track.id);
      });

      setSelectedOnlineTracks(currentDict => {
         const isAddingDict = !currentDict[track.id] && !allSongs.some(t => t.id === track.id);
         const isRemovingDict = !!currentDict[track.id];
         
         if (isAddingDict) {
            return { ...currentDict, [track.id]: track };
         } else if (isRemovingDict) {
            const newDict = { ...currentDict };
            delete newDict[track.id];
            return newDict;
         }
         return currentDict;
      });
   }, [allSongs]);

   const backP = useP();
   const createP = useP();

   const handleCreate = () => {
      const trimmedName = name.trim();
      if (!trimmedName) {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
         Alert.alert('Name required', 'Please give your playlist a name.');
         return;
      }

      const newId = generatePlaylistId();

      // Create and populate playlist in the store synchronously first
      const store = usePlaylistStore.getState();
      store.createPlaylist(newId, trimmedName, undefined, mood || undefined);
      if (added.length > 0) {
         const finalTracks = added.map(id => {
            const localMatch = allSongs.find(t => t.id === id);
            if (localMatch) return localMatch;
            return selectedOnlineTracks[id];
         }).filter(Boolean) as PlayerTrack[];
         
         if (finalTracks.length > 0) {
            store.addMultipleTracks(newId, finalTracks);
         }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Perform instant route transition
      Keyboard.dismiss();
      router.replace(`/playlist/${newId}`);
   };

   return (
      <View style={s.root}>
         <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

         {/* ── ANIMATED BG ───────────────────────────────────────────────────── */}
         <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
            <Animated.View style={[s.blob, { width: SW * 0.90, height: SW * 0.90, backgroundColor: '#2a0053', left: '-25%', top: b1T, opacity: b1Op }]} />
            <Animated.View style={[s.blob, { width: SW * 0.70, height: SW * 0.70, backgroundColor: '#003731', right: '-25%', bottom: '15%', opacity: b2Op }]} />
            <Animated.View style={[s.blob, {
               width: SW * 0.50, height: SW * 0.50, backgroundColor: '#1a0038', left: '-8%', bottom: '35%',
               opacity: bgP.interpolate({ inputRange: [0, 1, 2], outputRange: [0.06, 0.13, 0.08] })
            }]} />
            <LinearGradient
               colors={['rgba(13,13,18,0.05)', 'rgba(13,13,18,0.60)', 'rgba(13,13,18,0.95)']}
               locations={[0, 0.4, 1]}
               style={StyleSheet.absoluteFill}
            />
         </View>

         {/* ── HEADER ────────────────────────────────────────────────────────── */}
         <View style={[s.header, { paddingTop: insets.top + (isTablet ? 24 : 16) }]}>
            <Animated.View style={{ transform: [{ scale: backP.sc }] }}>
               <TouchableOpacity
                  style={s.backCircle}
                  onPressIn={backP.onIn} onPressOut={backP.onOut}
                  onPress={() => router.back()} activeOpacity={1}
               >
                  <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: 'rgba(255,255,255,0.04)' }} />
                  <Ionicons name="chevron-back" size={22} color={C.primary} />
               </TouchableOpacity>
            </Animated.View>

            <Text style={s.headerTitle}>Create Playlist</Text>
            {/* balance spacer — no 3-dot needed */}
            <View style={{ width: 44 }} />
         </View>

         {/* ── SCROLL ────────────────────────────────────────────────────────── */}
         <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 260 }}
         >
            {/* Hero text */}
            <Mat delay={60}>
               <View style={s.heroSection}>
                  <Text style={s.heroTitle}>
                     Build your <Text style={{ color: C.primary }}>next vibe</Text>
                  </Text>
                  <Text style={s.heroSub}>Set the mood, add the tracks, and let the rhythm flow.</Text>
               </View>
            </Mat>

            {/* Cover art */}
            <Mat delay={120}>
               <View style={s.coverWrap}>
                  <CoverArt addedTracks={added} allSongs={allSongs} />
                  {/* Auto generate cover pill */}
                  <TouchableOpacity style={s.autoGenBtn} activeOpacity={0.85}>
                     <Glass style={s.autoGenGlass} r={22} blur={50} accent>
                        <View style={s.autoGenRow}>
                           <Ionicons name="sparkles" size={13} color={C.accent} />
                           <Text style={s.autoGenText}>Auto generate cover</Text>
                        </View>
                     </Glass>
                  </TouchableOpacity>
               </View>
            </Mat>

            {/* Form fields */}
            <Mat delay={180}>
               <View style={s.formSection}>
                  {/* Playlist name — white pill (matches image) */}
                  <View style={s.inputGroup}>
                     <Text style={s.inputLabel}>PLAYLIST NAME</Text>
                     <View style={s.nameInputWrap}>
                        <TextInput
                           ref={nameInputRef}
                           placeholder="Late Night Jazz..."
                           placeholderTextColor={C.placeholder}
                           style={s.nameInput}
                           value={name}
                           onChangeText={setName}
                           returnKeyType="done"
                           onSubmitEditing={() => Keyboard.dismiss()}
                        />
                     </View>
                  </View>
               </View>
            </Mat>

            {/* Mood tags */}
            <Mat delay={260}>
               <View style={s.sectionBlock}>
                  <Text style={s.sectionTitle}>{"What's the mood?"}</Text>
                  <View style={s.moodRow}>
                     {MOODS.map((item) => {
                        const active = mood === item;
                        return (
                           <MoodChip key={item} item={item} active={active} onPress={() => setMood(item)} />
                        );
                     })}
                  </View>
               </View>
            </Mat>

            {/* Suggested tracks + search */}
            <Mat delay={340}>
               <View style={s.listHeader}>
                  <Text style={s.listTitle}>Suggested Tracks</Text>
                  <TouchableOpacity onPress={() => { setShowAll(v => !v); Haptics.selectionAsync(); }}>
                     <Text style={s.viewAll}>{showAll ? 'Show less' : 'View all'}</Text>
                  </TouchableOpacity>
               </View>
            </Mat>

            {/* Search bar */}
            <Mat delay={380}>
               <Glass style={s.searchBar} r={30} blur={60}>
                  <Ionicons name="search" size={19} color={C.dim} style={s.searchIcon} />
                  <TextInput
                     placeholder="Search for artists or songs"
                     placeholderTextColor={C.dim}
                     style={s.searchInput}
                     value={query}
                     onChangeText={setQuery}
                     returnKeyType="search"
                     clearButtonMode="while-editing"
                  />
                  {query.length > 0 && (
                     <TouchableOpacity onPress={() => { setQuery(''); setOnlineResults([]); setIsSearching(false); }} style={s.clearBtn}>
                        <Ionicons name="close-circle" size={18} color={C.dim} />
                     </TouchableOpacity>
                  )}
               </Glass>
            </Mat>

            {/* Track list */}
            <View style={s.trackList}>
               {allSongs.length === 0 && !query.trim() ? (
                  <Mat delay={0}>
                     <View style={s.emptySearch}>
                        <Ionicons name="cloud-download-outline" size={36} color={C.dim} />
                        <Text style={s.emptyText}>No downloaded songs</Text>
                        <Text style={[s.emptyText, { fontSize: 13, marginTop: 4 }]}>
                           Search online or download tracks first
                        </Text>
                     </View>
                  </Mat>
               ) : filtered.length === 0 && onlineResults.length === 0 && !isSearching && query.trim().length > 0 ? (
                  <Mat delay={0}>
                     <View style={s.emptySearch}>
                        <Ionicons name="search-outline" size={36} color={C.dim} />
                        <Text style={s.emptyText}>{`No results for "${query}"`}</Text>
                     </View>
                  </Mat>
               ) : (
                  <>
                     {filtered.length > 0 && (
                        <View style={{ marginBottom: query.length >= 2 ? 24 : 0 }}>
                           <Text style={[s.sectionTitle, { marginLeft: 4, marginBottom: 8, fontSize: 13, color: C.dim }]}>Downloaded</Text>
                           {filtered.map((track, idx) => (
                              <Mat key={`filtered-${track.id}-${idx}`} delay={idx * 40}>
                                 <TrackRow track={track} added={added.includes(track.id)} onToggle={toggleAdded} />
                              </Mat>
                           ))}
                        </View>
                     )}
                     
                     {query.length >= 2 && (
                        <View>
                           <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, marginBottom: 8, gap: 8 }}>
                              <Text style={[s.sectionTitle, { fontSize: 13, color: C.dim }]}>Online Results</Text>
                              {isSearching && <Animated.View style={{ opacity: 0.7 }}><Ionicons name="sync" size={14} color={C.accent} /></Animated.View>}
                           </View>
                           
                           {onlineResults.length > 0 ? (
                              onlineResults.map((track, idx) => (
                                 <Mat key={`online-${track.id}-${idx}`} delay={(filtered.length + idx) * 40}>
                                    <TrackRow track={track} added={added.includes(track.id)} onToggle={toggleAdded} />
                                 </Mat>
                              ))
                           ) : isSearching ? (
                              <View style={{ padding: 16, alignItems: 'center' }}>
                                 <Text style={{ color: C.dim, fontSize: 13, fontFamily: 'Inter_500Medium' }}>Searching online...</Text>
                              </View>
                           ) : (
                              <View style={{ padding: 16, alignItems: 'center' }}>
                                 <Text style={{ color: C.dim, fontSize: 13, fontFamily: 'Inter_500Medium' }}>No online matches</Text>
                              </View>
                           )}
                        </View>
                     )}
                  </>
               )}
            </View>

            {/* Added count badge */}
            {added.length > 0 && (
               <Mat delay={0}>
                  <View style={s.addedBadge}>
                     <Glass style={s.addedBadgeInner} r={16} blur={50} accent>
                        <LinearGradient colors={[h2r(C.primary, 0.15), h2r(C.primaryMid, 0.08)]} style={StyleSheet.absoluteFill} />
                        <Ionicons name="musical-notes" size={16} color={C.primary} />
                        <Text style={s.addedText}>{added.length} track{added.length !== 1 ? 's' : ''} added</Text>
                     </Glass>
                  </View>
               </Mat>
            )}

            {/* Create Playlist Button inside ScrollView flow */}
            <Mat delay={420}>
               <Animated.View style={[{ width: '100%', marginTop: 40, marginBottom: insets.bottom + 60 }, { transform: [{ scale: createP.sc }] }]}>
                  <TouchableOpacity
                     style={s.createBtn}
                     onPressIn={createP.onIn} onPressOut={createP.onOut}
                     onPress={handleCreate} activeOpacity={1}
                  >
                     <LinearGradient
                        colors={[C.primary, C.primaryMid, C.primaryDp]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                     />
                     <View style={{ position: 'absolute', top: 4, left: 32, right: 32, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.30)' }} />
                     <View style={{ position: 'absolute', left: 14, top: 10, width: 28, bottom: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ skewX: '-8deg' }] }} />
                     <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', backgroundColor: 'rgba(255,255,255,0.04)' }} />
                     <Text style={s.createText}>Create Playlist</Text>
                  </TouchableOpacity>
               </Animated.View>
            </Mat>
         </ScrollView>
      </View>
   );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
   root: { flex: 1, backgroundColor: C.bg },
   blob: { position: 'absolute', borderRadius: SW * 0.5 },

   // header
   header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: PAD, paddingBottom: 12,
   },
   backCircle: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
   },
   headerTitle: {
      fontSize: 18, fontWeight: '700', color: C.text,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
      letterSpacing: -0.2,
   },

   // hero
   heroSection: { marginBottom: 32 },
   heroTitle: {
      fontSize: isTablet ? 48 : 40, fontWeight: '900', color: C.text,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
      letterSpacing: -1.3, lineHeight: isTablet ? 54 : 46,
   },
   heroSub: {
      fontSize: 16, color: C.muted, marginTop: 10, lineHeight: 23,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
   },

   // cover
   coverWrap: { alignItems: 'center', marginBottom: 40 },
   coverOuter: { position: 'relative', alignItems: 'center' },
   coverBox: {
      width: isTablet ? 220 : 196, height: isTablet ? 220 : 196,
      justifyContent: 'center', alignItems: 'center',
      ...Platform.select({
         ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.55, shadowRadius: 28 },
         android: { elevation: 20 },
      }),
   },
   coverEmpty: { alignItems: 'center', gap: 10 },
   coverHint: { fontSize: 12, color: C.dim, textAlign: 'center', fontWeight: '500' },
   coverGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 4, gap: 4, borderRadius: 24, overflow: 'hidden' },
   coverGridImg: { width: 88, height: 88, borderRadius: 10 },
   coverGlow: {
      position: 'absolute', bottom: -16, left: '15%', right: '15%', height: 32,
      ...Platform.select({
         ios: { shadowColor: C.primary, shadowRadius: 20, shadowOpacity: 0.60, shadowOffset: { width: 0, height: 0 } },
      }),
   },
   autoGenBtn: { marginTop: 20 },
   autoGenGlass: { paddingVertical: 11, paddingHorizontal: 20 },
   autoGenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   autoGenText: {
      fontSize: 14, fontWeight: '700', color: C.accent,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium'
   },

   // form
   formSection: { gap: 22, marginBottom: 32 },
   inputGroup: { gap: 9 },
   inputLabel: {
      fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.45)',
      letterSpacing: 1.6, marginLeft: 4,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
   },
   // white pill (matches image exactly)
   nameInputWrap: {
      backgroundColor: C.inputBg, borderRadius: 40, height: 62,
      justifyContent: 'center',
      ...Platform.select({
         ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 14 },
         android: { elevation: 6 },
      }),
   },
   nameInput: {
      fontSize: 17, fontWeight: '600', color: C.inputText,
      paddingHorizontal: 24,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
   },
   descWrap: { minHeight: 108 },
   descInput: {
      fontSize: 15, color: C.text, padding: 18, minHeight: 108,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
   },

   // mood
   sectionBlock: { marginBottom: 32 },
   sectionTitle: {
      fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 16,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', letterSpacing: -0.3,
   },
   moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
   moodTag: { paddingHorizontal: 18, paddingVertical: 10, overflow: 'hidden' },
   moodTagActive: { borderColor: h2r(C.primary, 0.50) },
   moodText: {
      fontSize: 14, fontWeight: '600', color: C.muted,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
   },
   moodTextActive: { color: C.primary, fontWeight: '700' },

   // track list
   listHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18,
   },
   listTitle: {
      fontSize: isTablet ? 28 : 24, fontWeight: '800', color: C.text,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium', letterSpacing: -0.4,
   },
   viewAll: { fontSize: 14, fontWeight: '700', color: C.primary },

   // search
   searchBar: { flexDirection: 'row', alignItems: 'center', height: 56, marginBottom: 18 },
   searchIcon: { marginLeft: 18, marginRight: 4 },
   searchInput: {
      flex: 1, fontSize: 16, color: C.text, paddingHorizontal: 8,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
   },
   clearBtn: { paddingRight: 14 },

   // tracks
   trackList: { gap: 11 },
   trackItem: {},
   trackInner: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 14 },
   trackArt: {
      width: isTablet ? 60 : 54, height: isTablet ? 60 : 54, borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.05)',
   },
   trackMeta: { flex: 1 },
   trackTitle: {
      fontSize: isTablet ? 16 : 15, fontWeight: '700', color: C.text,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
   },
   trackArtist: { fontSize: 12, color: C.muted, marginTop: 3 },
   addBtnOuter: { padding: 2 },
   addBtn: {
      width: 38, height: 38, borderRadius: 19,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1,
   },

   // empty search
   emptySearch: { alignItems: 'center', paddingVertical: 32, gap: 10 },
   emptyText: { fontSize: 15, color: C.dim, fontWeight: '500' },

   // added badge
   addedBadge: { alignItems: 'center', marginTop: 20 },
   addedBadgeInner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 18, paddingVertical: 10, overflow: 'hidden',
   },
   addedText: { fontSize: 14, fontWeight: '700', color: C.primary },

   // footer
   footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: PAD, alignItems: 'center',
   },
   footerFade: {
      position: 'absolute', top: -60, left: 0, right: 0, bottom: 0,
   },
   createBtn: {
      width: '100%', height: 62, borderRadius: 32,
      overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      ...Platform.select({
         ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 18 },
         android: { elevation: 14 },
      }),
   },
   createText: {
      fontSize: 18, fontWeight: '800', color: '#FFF', zIndex: 2,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
      letterSpacing: -0.2,
      textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
   },
});

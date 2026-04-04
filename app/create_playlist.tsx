import React, { useMemo, useRef, useEffect, useState } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
   primary: '#dab9ff',
   primaryMid: '#6c37a9',
   secondary: '#46f5e0',
   surface: '#131318',
   text: '#e4e1e9',
   muted: '#cbc3d9',
   border: 'rgba(255,255,255,0.1)',
};

const GlassCard = ({ children, style, radius = 24 }: any) => (
   <View style={[styles.glassBase, { borderRadius: radius }, style]}>
      <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.glassStroke, { borderRadius: radius }]} />
      {children}
   </View>
);

const FadeIn = ({ children, delay = 0 }: any) => {
   const opacity = useRef(new Animated.Value(0)).current;
   const translate = useRef(new Animated.Value(12)).current;

   useEffect(() => {
      Animated.parallel([
         Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
         Animated.spring(translate, { toValue: 0, delay, useNativeDriver: true }),
      ]).start();
   }, []);

   return (
      <Animated.View style={{ opacity, transform: [{ translateY: translate }] }}>
         {children}
      </Animated.View>
   );
};

export default function CreatePlaylistScreen() {
   const insets = useSafeAreaInsets();
   const router = useRouter();

   const [name, setName] = useState('');
   const [desc, setDesc] = useState('');
   const [privacy, setPrivacy] = useState('Public');
   const [mood, setMood] = useState('#Chill');

   const moods = ['#Chill', '#Workout', '#Focus', '#Sleep', '#Party'];

   const tracks = useMemo(() => [
      { id: '1', title: 'Electric Dreams', artist: 'Neon Pulse', art: 'https://picsum.photos/200?1' },
      { id: '2', title: 'Urban Echoes', artist: 'Lofi Soul', art: 'https://picsum.photos/200?2' },
      { id: '3', title: 'Midnight Voyage', artist: 'The Explorers', art: 'https://picsum.photos/200?3' },
   ], []);

   return (
      <View style={styles.root}>
         <StatusBar barStyle="light-content" />
         
         {/* Deep Mesh Background */}
         <View style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#131318' }]} />
            <LinearGradient colors={['rgba(108, 55, 169, 0.12)', 'transparent']} style={styles.glowTopLeft} />
            <LinearGradient colors={['rgba(70, 245, 224, 0.08)', 'transparent']} style={styles.glowTopRight} />
         </View>

         {/* Header */}
         <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtnOuter}>
               <GlassCard style={styles.headerBtn} radius={22}>
                  <Ionicons name="arrow-back" size={20} color={C.primary} />
               </GlassCard>
            </TouchableOpacity>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
               <Text style={styles.headerTitle}>Create Playlist</Text>
            </View>
         </View>

         <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 200, paddingTop: 20 }}
         >
            {/* Title Section */}
            <FadeIn delay={100}>
               <View style={styles.heroSection}>
                  <Text style={styles.heroTitle}>Build your <Text style={{ color: C.primary }}>next vibe</Text></Text>
                  <Text style={styles.heroSub}>Set the mood, add the tracks, and let the rhythm flow.</Text>
               </View>
            </FadeIn>

            {/* Cover Section */}
            <FadeIn delay={180}>
               <View style={styles.coverWrap}>
                  <GlassCard style={styles.coverBox} radius={24}>
                     <View style={styles.coverPlaceholder}>
                        <Ionicons name="musical-note" size={64} color="rgba(218, 185, 255, 0.3)" />
                     </View>
                  </GlassCard>
                  <TouchableOpacity style={styles.autoGenBtn}>
                     <GlassCard style={styles.autoGenGlass} radius={20}>
                        <View style={styles.autoGenContent}>
                           <Ionicons name="sparkles" size={14} color={C.secondary} />
                           <Text style={styles.autoGenText}>Auto generate cover</Text>
                        </View>
                     </GlassCard>
                  </TouchableOpacity>
               </View>
            </FadeIn>

            {/* Form Fields */}
            <FadeIn delay={260}>
               <View style={styles.formSection}>
                  <View style={styles.inputGroup}>
                     <Text style={styles.inputLabel}>PLAYLIST NAME</Text>
                     <TextInput
                        placeholder="Late Night Jazz..."
                        placeholderTextColor="#6a6575"
                        style={styles.nameInput}
                        value={name}
                        onChangeText={setName}
                     />
                  </View>
                  <View style={styles.inputGroup}>
                     <Text style={styles.inputLabel}>DESCRIPTION</Text>
                     <TextInput
                        placeholder="Describe the vibe of this collection..."
                        placeholderTextColor="#6a6575"
                        style={[styles.nameInput, styles.descInput]}
                        multiline
                        value={desc}
                        onChangeText={setDesc}
                     />
                  </View>
               </View>
            </FadeIn>

            {/* Privacy */}
            <FadeIn delay={340}>
               <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>Privacy Setting</Text>
                  <View style={styles.privacyRow}>
                     <TouchableOpacity onPress={() => setPrivacy('Public')} style={[styles.privacyBtn, privacy === 'Public' && styles.privacyActive]}>
                        {privacy === 'Public' ? <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />}
                        <Ionicons name="globe" size={16} color={privacy === 'Public' ? '#131318' : 'white'} />
                        <Text style={[styles.privacyText, { color: privacy === 'Public' ? '#131318' : 'white' }]}>Public</Text>
                     </TouchableOpacity>

                     <TouchableOpacity onPress={() => setPrivacy('Private')} style={[styles.privacyBtn, privacy === 'Private' && styles.privacyActive]}>
                        {privacy === 'Private' ? <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />}
                        <Ionicons name="lock-closed" size={16} color={privacy === 'Private' ? '#131318' : 'white'} />
                        <Text style={[styles.privacyText, { color: privacy === 'Private' ? '#131318' : 'white' }]}>Private</Text>
                     </TouchableOpacity>

                     <TouchableOpacity onPress={() => setPrivacy('Shared')} style={[styles.privacyBtn, privacy === 'Shared' && styles.privacyActive]}>
                        {privacy === 'Shared' ? <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />}
                        <Ionicons name="people" size={16} color={privacy === 'Shared' ? '#131318' : 'white'} />
                        <Text style={[styles.privacyText, { color: privacy === 'Shared' ? '#131318' : 'white' }]}>Shared</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </FadeIn>

            {/* Mood Tags */}
            <FadeIn delay={420}>
               <View style={styles.sectionWrap}>
                  <Text style={styles.sectionHeading}>What's the mood?</Text>
                  <View style={styles.moodWrap}>
                     {moods.map((item) => (
                        <TouchableOpacity key={item} onPress={() => setMood(item)}>
                           <GlassCard style={[styles.moodTag, mood === item && styles.moodTagActive]} radius={18}>
                              <Text style={[styles.moodTagText, mood === item && { color: C.secondary }]}>{item}</Text>
                           </GlassCard>
                        </TouchableOpacity>
                     ))}
                  </View>
               </View>
            </FadeIn>

            {/* Suggested Tracks */}
            <FadeIn delay={500}>
               <View style={styles.listHeader}>
                  <Text style={styles.sectionHeadingLarge}>Suggested Tracks</Text>
                  <TouchableOpacity><Text style={styles.viewAll}>View all</Text></TouchableOpacity>
               </View>
               <View style={styles.searchWrap}>
                  <Ionicons name="search" size={20} color="#6a6575" style={{ marginLeft: 16 }} />
                  <TextInput
                     placeholder="Search for artists or songs"
                     placeholderTextColor="#6a6575"
                     style={styles.searchInput}
                  />
               </View>
               <View style={styles.trackList}>
                  {tracks.map((track) => (
                     <GlassCard key={track.id} style={styles.trackItem} radius={20}>
                        <Image source={{ uri: track.art }} style={styles.trackArt} />
                        <View style={styles.trackMeta}>
                           <Text style={styles.trackTitle}>{track.title}</Text>
                           <Text style={styles.trackArtist}>{track.artist}</Text>
                        </View>
                        <TouchableOpacity style={styles.addBtn}>
                           <Ionicons name="add" size={22} color={C.primary} />
                        </TouchableOpacity>
                     </GlassCard>
                  ))}
               </View>
            </FadeIn>
         </ScrollView>

         {/* Sticky Footer */}
         <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={StyleSheet.absoluteFill}>
               <LinearGradient colors={['transparent', '#131318']} style={{ flex: 1 }} />
            </View>
            <TouchableOpacity style={styles.createBtn} activeOpacity={0.9}>
               <LinearGradient colors={[C.primary, C.primaryMid]} style={StyleSheet.absoluteFill} />
               <Text style={styles.createText}>Create Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.draftBtn}>
               <Text style={styles.draftText}>Save as Draft</Text>
            </TouchableOpacity>
         </View>
      </View>
   );
}

const styles = StyleSheet.create({
   root: { flex: 1, backgroundColor: '#131318' },
   glassBase: { overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
   glassStroke: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

   glowTopLeft: { position: 'absolute', top: -100, left: -100, width: 300, height: 300, borderRadius: 150 },
   glowTopRight: { position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: 125 },

   header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
   headerBtnOuter: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
   headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
   headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },

   heroSection: { marginBottom: 32 },
   heroTitle: { color: 'white', fontSize: 42, fontWeight: '800', letterSpacing: -1.2, lineHeight: 48 },
   heroSub: { color: C.muted, fontSize: 16, marginTop: 8, lineHeight: 22 },

   coverWrap: { alignItems: 'center', marginBottom: 40 },
   coverBox: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center' },
   coverPlaceholder: { opacity: 0.8 },
   autoGenBtn: { marginTop: 22 },
   autoGenGlass: { paddingVertical: 10, paddingHorizontal: 18 },
   autoGenContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
   autoGenText: { color: C.secondary, fontWeight: '700', fontSize: 14 },

   formSection: { gap: 24, marginBottom: 32 },
   inputGroup: { gap: 8 },
   inputLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginLeft: 16 },
   nameInput: { 
      backgroundColor: 'white', 
      borderRadius: 40, 
      height: 60, 
      color: '#131318', 
      fontSize: 18, 
      fontWeight: '600', 
      paddingHorizontal: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
   },
   descInput: { 
      backgroundColor: 'rgba(255,255,255,0.06)', 
      height: 110, 
      textAlignVertical: 'top', 
      paddingTop: 18, 
      color: 'white',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
   },

   sectionWrap: { marginBottom: 32 },
   sectionHeading: { color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 16 },
   privacyRow: { flexDirection: 'row', gap: 12 },
   privacyBtn: { 
      flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
      overflow: 'hidden', minWidth: 100, justifyContent: 'center',
   },
   privacyActive: { elevation: 8, shadowColor: C.primary, shadowOpacity: 0.2, shadowRadius: 10 },
   privacyText: { fontSize: 14, fontWeight: '700' },

   moodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
   moodTag: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
   moodTagActive: { borderColor: C.primary, backgroundColor: 'rgba(218,185,255,0.1)' },
   moodTagText: { color: '#cbc3d9', fontWeight: '600', fontSize: 14 },

   listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
   sectionHeadingLarge: { color: 'white', fontSize: 26, fontWeight: '800' },
   viewAll: { color: C.primary, fontWeight: '700', fontSize: 14 },
   searchWrap: { 
      flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 30, height: 60,
      marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
   },
   searchInput: { flex: 1, paddingHorizontal: 16, color: 'white', fontSize: 16 },
   trackList: { gap: 12 },
   trackItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
   trackArt: { width: 56, height: 56, borderRadius: 12 },
   trackMeta: { flex: 1, marginLeft: 16 },
   trackTitle: { color: 'white', fontWeight: '700', fontSize: 16 },
   trackArtist: { color: C.muted, fontSize: 12, marginTop: 4 },
   addBtn: { 
      width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', 
      alignItems: 'center', justifyContent: 'center',
   },

   footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, alignItems: 'center' },
   footerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 200 },
   createBtn: { width: '100%', height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 12 },
   createText: { color: 'black', fontSize: 18, fontWeight: '800' },
   draftBtn: { marginTop: 14, marginBottom: 8 },
   draftText: { color: C.muted, fontWeight: '600', fontSize: 14 },
});

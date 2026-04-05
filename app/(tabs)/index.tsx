import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SW } = Dimensions.get('window');
const PAD = 24;

// ── Design Tokens ──────────────────────────────────────────────────────────
const C = {
  primary: '#BF5AF2',
  primaryMid: '#9B38DA',
  primaryDeep: '#7B2FBE',
  accent: '#46f5e0',
  bg: '#131318',
  surface: 'rgba(28,28,32,0.6)',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textMuted: '#cbc3d9',
  onSurfaceVariant: '#cbc3d9',
};

const SP = { tension: 65, friction: 10 };

// ── UTILS ──────────────────────────────────────────────────────────────────
const h2r = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ── COMPONENTS ─────────────────────────────────────────────────────────────

const Glass = ({ children, style, r = 24, blur = 60 }: any) => (
  <View style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, style]}>
    <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: r * 0.5, right: r * 0.5, height: 1.2, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 5 }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 8, top: 12, bottom: 12, width: 2, backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ skewX: '-8deg' }], zIndex: 5 }} />
    <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, borderRadius: r, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.015)' }} />
    {children}
  </View>
);

const Mat = ({ children, delay = 0, style }: any) => {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, ...SP, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return <Animated.View style={[{ opacity: op, transform: [{ translateY: ty }] }, style]}>{children}</Animated.View>;
};

// ── MAIN SCREEN ────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/now_playing');
  }, []);

  /**
   * Determine Greeting based on current time
   */
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return { 
        title: 'Good morning', 
        sub: 'Rise and shine for some morning beats.' 
      };
    } else if (hour >= 12 && hour < 17) {
      return { 
        title: 'Good afternoon', 
        sub: 'Keep the energy up with some mid-day vibes.' 
      };
    } else if (hour >= 17 && hour < 21) {
      return { 
        title: 'Good evening', 
        sub: 'Ready for some evening vibes?' 
      };
    } else {
      return { 
        title: 'Good night', 
        sub: 'Wind down with some midnight melodies.' 
      };
    }
  }, []);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent />

      {/* ── BACKGROUND ─────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg }]} />
        <View style={[s.blob, { width: 400, height: 400, top: -100, left: -100, backgroundColor: 'rgba(42, 0, 83, 0.4)' }]} />
        <View style={[s.blob, { width: 300, height: 300, top: 100, right: -50, backgroundColor: 'rgba(26, 35, 126, 0.3)' }]} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 10, paddingBottom: 180 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── TOP BAR ───────────────────────────────────────────────── */}
        <Mat delay={0}>
          <View style={s.topBar}>
            <TouchableOpacity style={s.iconBtn}>
              <Ionicons name="menu-outline" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.auraTitle}>AURA</Text>
            <TouchableOpacity style={s.avatarWrap}>
              <Image 
                source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDq3UiIFYmXinYSygwycRPkhHqUPl-UkDcPvDxab48mPT5NoCsBLsoOWIlUgYaDWTGtS8AXlohZaHBEqMUtjoJDm4VLoWKd804rVhD5AQxfTpklt7R3M8b06DqdJEBtweTm-qrFz2yLRHXR7aexhYT6H0hlraCiE9N0B9TKSPTHzeFPHcU0ZgIGFRBvTkScWFHehD31upgs9T0FHgUJpunctld6r4qTrHEPKNKPKI4zrpF4JC0omB_ue5YxIOFxu66HVpEq8eGJmjM' }}
                style={s.avatarImg}
                contentFit="cover"
              />
            </TouchableOpacity>
          </View>
        </Mat>

        {/* ── WELCOME ───────────────────────────────────────────────── */}
        <Mat delay={100}>
          <View style={s.welcomeWrap}>
            <Text style={s.welcomeText}>{greetingData.title}</Text>
            <Text style={s.welcomeSub}>{greetingData.sub}</Text>
          </View>
        </Mat>

        {/* ── FEATURED HERO ─────────────────────────────────────────── */}
        <Mat delay={200}>
          <View style={s.heroCard}>
            <Image 
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7QyWLCr0uXkrtCWoGoXTfHFzGXwGP0GfezAi3bE1Zoy0n-ZxGCu75tlVWLIreBKwK5XYqs_bwhB9bZFS-RwHRzHg-cMww0yFFfnkcqDILEMzFzw3UzMLb7wQ9fqgC831em3RUpLtE4tqyhWEK7tn02kW1lhye7OMIwbQq2vDp-KmoMZR5SwzyyOOC7_RIGQBU2kZoZzZvgJB_GnEYPXGuzd_uECbnuBe-WvSzMuoei4vaBoL41TggGTxAg8xZZ0DOf9H-cVvvZ0k' }}
              style={s.heroImg}
              contentFit="cover"
            />
            <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
            
            <View style={s.heroBottomGlass}>
              <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={s.heroInfo}>
                <Text style={s.heroTitle}>Neon Dreams</Text>
                <Text style={s.heroSub}>The Midnight Syndicate • New Release</Text>
              </View>
              <View style={s.heroControls}>
                <View style={s.pagination}>
                  <View style={s.dotActive} />
                  <View style={s.dot} />
                  <View style={s.dot} />
                </View>
                <TouchableOpacity style={s.heroPlay} onPress={handlePlay}>
                  <LinearGradient colors={[h2r('#BF5AF2', 0.8), h2r('#9B38DA', 0.9)]} style={StyleSheet.absoluteFill} />
                  <Ionicons name="play" size={30} color="#FFF" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Mat>

        {/* ── CONTINUE LISTENING ────────────────────────────────────── */}
        <Mat delay={300}>
          <View style={s.secHeader}>
            <Text style={s.secTitle}>Continue Listening</Text>
            <TouchableOpacity><Text style={s.seeAll}>See all</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hzScroll}>
            {[
              { id: '1', title: 'Echoes of Silence', artist: 'Lumina Flux', progress: 0.65, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBuR9gtgG2taTyKjZRlQHCINlUJhPKf77RSnLwOI5myjgMiss5yfKiQWMLKqmDyPUvYFZNfajHryldnBZAOubdN0-MHrSMpeyVGMKL1XlfNUYxkpiz2gWZi2a3mXLaJa_XFGR7EJea5BCFm6wuO-FJXBi93TtaUy998C3CYdOiJ_ZoeiWvtdFxt-dqgWsT9lXrOrn6F8-HQBjIFBsqro5honANAglneK_aO_FLIYAFkm6lJyjKjKEoBnouCeINOTQ-CVrZV2MHKfTA' },
              { id: '2', title: 'Urban Jungle', artist: 'Concrete Beats', progress: 0.25, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjFukE_sRjHe5_Yn5GUu9-diK45r5uJJqkA11fLWsqdBhWFZICFt3M-famObOj7lZyps1XNA35R02BfM_qXiKHTw0J64_PwKqyYWwWrcvT-PY8gkfldq0OFOu4-C48MrU9mFbsCQmYbnrg2MgIq3rsg3fbLMkqvTc_EE7Q1m2i0kuEY9mFFVOA0J7bvSlOnBDyBcRK9Qil_y1yHmZqPpvAoniYSyhfspTprmNEzT-NAkI3CMVfqdxHK-zGg8qz71GUUBQOhdiNHbc' },
            ].map((item, idx) => (
              <TouchableOpacity key={item.id} style={s.hzCard} onPress={handlePlay}>
                <View style={s.hzArtWrap}>
                  <Image source={{ uri: item.img }} style={s.hzArt} contentFit="cover" />
                  <View style={s.hzProgressBase}>
                    <View style={[s.hzProgressFill, { width: `${item.progress * 100}%` }]} />
                  </View>
                </View>
                <Text style={s.hzTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.hzArtist} numberOfLines={1}>{item.artist}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Mat>

        {/* ── MADE FOR YOU ──────────────────────────────────────────── */}
        <Mat delay={400}>
          <View style={s.welcomeWrap}>
            <Text style={s.secTitle}>Made For You</Text>
          </View>
          <View style={s.bentoWrap}>
            <TouchableOpacity style={s.bentoLarge} activeOpacity={0.9} onPress={handlePlay}>
              <Glass r={32} style={s.bentoContainer}>
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbCEPz7a_kipZIvCkizjA-gRvtXsLOA9-JTFoghz0Lie05VF_dCSzHZ2ztBnzlyVIPIrJ2xfCZMeNKuXVQTrwcijbem9x3Pse4F6zwRLouBtw3VnfLsCztxLrmNzjxNDuSiABv4pZFUjI1F0k0lhlnuoVIFVUD5ZH-rxbuBmzWTtwzZ8-MownkdckipRFY0MbcI6x0RhkzgOMx4_t9ktr99nlzj3PJPvdKgPxBFd9GAhWpdNeUaQT-k43YZsTMS9MPnz4D2XcyQdE' }}
                  style={s.bentoBg}
                />
                <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                <View style={s.bentoContent}>
                  <View style={s.tag}>
                    <Text style={s.tagText}>PERSONALIZED</Text>
                  </View>
                  <Text style={s.bentoTitle}>Daily Mix 1</Text>
                  <Text style={s.bentoSub}>Experimental pop, synthwave, and indie electronic just for you.</Text>
                </View>
              </Glass>
            </TouchableOpacity>

            <TouchableOpacity style={[s.bentoLarge, { marginTop: 16 }]} activeOpacity={0.9} onPress={handlePlay}>
              <Glass r={32} style={s.bentoContainer}>
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAdQx6GH0zorHcncabs7EQjwwt6Ff4YQFydz1_wbFzgX0L65ePdvwSnhkkWPUhIoqLAeGzwr7ucwdLzHfwpeH3bpFU2YdaV4cZPmJewuMrK3xGRF9l3sItRS6c88RspFXNmeZZkpf9K0C12oMAyLJVpVFkeB5wO5pfTz-0V082H28TUOLxTOzRQGVFJtNc3U5uKM3qxuEVRVdgHno7aBCeEyWw4lcW46wjW1e-ipK6xgKuGLRZOtiL-ADDQbsodniQ5YHU6z2TiRbo' }}
                  style={s.bentoBg}
                />
                <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                <View style={s.bentoContent}>
                  <Text style={s.bentoTitle}>Focus Flow</Text>
                  <Text style={s.bentoSub}>Deep ambient for concentration.</Text>
                </View>
              </Glass>
            </TouchableOpacity>
          </View>
        </Mat>

        {/* ── RECENTLY PLAYED ────────────────────────────────────────── */}
        <Mat delay={500}>
          <View style={s.welcomeWrap}>
            <Text style={s.secTitle}>Recently Played</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.circleScroll}>
            {[
              { id: '1', name: 'Solstice', art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAv0JnQ4vMAUMZPLHf8_5kSD5mlzNell4lTFMe4PW1ntOTOWHLrkl9mG9j6UHuz5l03jHV1QhqkqlW02aAAiissJPNm66GBtmnUEdUIhd5TO4jkDJGnA2XM5dn0iZe0uHKdWaevk9k3xgDBQPgZzlNW4FlJCPUmKgPFqQ4OkotUNamHfhbLR5JNjOw0OUWEPXU940b8lSMV1EaeRO40UgPJFBXCZWmgC9iWPClYDFkB3ln3Ny0R6QHjYN-tdmuMPLPuIvc6cbY2qeg' },
              { id: '2', name: 'Luna Ray', art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClekhO35H1-CBAh_IAbps85MfN8ykBnyWS2XmdjmuGoVmkVcXFGyaaV_4FC0CvNMXPmwrrCHc1CVhd3WadESEIS0oaSO8wGQ5-4MgxJRn4jyoYONpus0InxiVvB-qXG6ZyeQQSUm821V6o_nDcQJN0TM-sO_PCRKpFBuwiEignbri7blbD7fa2cwu19ZyVIJet6gf4BuIIWVo3158xmp_VOi6CW0ytmQGJxEcvzrh2Q1UaaWxztFzmR1Qq1p-Aaa8sHP4lP5aop0Y' },
              { id: '3', name: 'Divergent', art: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAhQcif7-QjsbzxTmqO7ML0bZ3y3oCamVAUk1prt5w0xLlKY_t3FtWqDz-eossEpXpNHLHzaNLfw6oLqTdpcF5IxNPd_PHC2negic679aJ_98U1Vhym0ULwPVHp0GPe3hwJYqdIeT7WXZDvLG-_9z2CDMuF3xDv962rDDOb-wdEKx9EPrVg9uTuza5Zlitmn-0rLBBbiDOgsESsZI2Wx-hjETVoXc6cC5viEFkr8T_hjzgx265dnxJlF2p0lTm9mUJ6ForN5q ArmPc' }
            ].map((artist, idx) => (
              <TouchableOpacity key={artist.id} style={s.circleItem} onPress={handlePlay}>
                <View style={s.circleArtWrap}>
                  <Image source={{ uri: artist.art }} style={s.circleArt} contentFit="cover" />
                  <View style={s.circleBorder} />
                </View>
                <Text style={s.circleName} numberOfLines={1}>{artist.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Mat>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: 'absolute', borderRadius: 999 },
  scroll: { },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginBottom: 20,
    marginTop: 10,
  },
  iconBtn: { padding: 4 },
  auraTitle: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    fontWeight: '900',
    letterSpacing: 4,
  },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  avatarImg: { width: '100%', height: '100%' },

  // Welcome
  welcomeWrap: { paddingHorizontal: PAD, marginBottom: 28 },
  welcomeText: { color: '#FFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  welcomeSub: { color: C.onSurfaceVariant, fontSize: 16, marginTop: 4, opacity: 0.8 },

  // Hero Card
  heroCard: {
    height: 380,
    marginHorizontal: PAD,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#1C1C20',
    marginBottom: 44,
  },
  heroImg: { width: '100%', height: '100%' },
  heroBottomGlass: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  heroInfo: { flex: 1 },
  heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4, fontStyle: 'italic' },
  heroControls: { alignItems: 'center', gap: 16 },
  pagination: { flexDirection: 'row', gap: 6 },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  heroPlay: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#BF5AF2',
    shadowRadius: 12,
    shadowOpacity: 0.5,
  },

  // Sections
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: PAD, marginBottom: 18 },
  secTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  seeAll: { color: '#dab9ff', fontWeight: '600', fontSize: 14 },

  // Hz Scroll
  hzScroll: { paddingHorizontal: PAD, gap: 24 },
  hzCard: { width: 200 },
  hzArtWrap: { width: 200, height: 200, borderRadius: 28, overflow: 'hidden', marginBottom: 12, backgroundColor: '#222' },
  hzArt: { width: '100%', height: '100%' },
  hzProgressBase: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  hzProgressFill: { height: '100%', backgroundColor: '#dab9ff' },
  hzTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  hzArtist: { color: C.onSurfaceVariant, fontSize: 13, marginTop: 2 },

  // Bento
  bentoWrap: { paddingHorizontal: PAD, marginBottom: 44 },
  bentoLarge: { width: '100%', height: 240 },
  bentoContainer: { flex: 1 },
  bentoBg: { ...StyleSheet.absoluteFillObject, opacity: 0.5 },
  bentoContent: { flex: 1, padding: 28, justifyContent: 'flex-end' },
  tag: { 
    backgroundColor: 'rgba(70, 245, 224, 0.15)', 
    borderWidth: 1, 
    borderColor: 'rgba(70, 245, 224, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
    alignSelf: 'flex-start'
  },
  tagText: { color: '#46f5e0', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  bentoTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  bentoSub: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 6, lineHeight: 20 },

  // Circles
  circleScroll: { paddingHorizontal: PAD, gap: 32 },
  circleItem: { alignItems: 'center' },
  circleArtWrap: { width: 120, height: 120, borderRadius: 60, padding: 4, marginBottom: 12 },
  circleArt: { width: '100%', height: '100%', borderRadius: 60 },
  circleBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 60, borderWidth: 2, borderColor: 'transparent' },
  circleName: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});

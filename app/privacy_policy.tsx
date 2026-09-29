/**
 * PrivacyPolicyScreen — Real, Factually Grounded Privacy Policy
 *
 * Grounded in AuraMusic's verified architecture:
 *  - 100% on-device / local-first architecture (no proprietary backend server).
 *  - Room SQLite (`aura_music.db`) & AsyncStorage for playlists, history, and settings.
 *  - Android sandbox storage (`documentDirectory/aura/`) for downloaded audio & art.
 *  - Direct network requests to YouTube/Google CDN (streaming) and LRCLIB (lyrics).
 *  - Zero third-party analytics/tracking/advertising SDKs (no Firebase, Mixpanel, etc.).
 *  - Explicit Android Auto Backup rules (`backup_rules.xml`) preserving databases (< 1 MB)
 *    while excluding audio files and media caches.
 *  - Full user data controls (cache clearing, download deletion, library purging).
 */

import React, { memo } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const BG = '#0F0F13';
const PRIMARY = '#BF5AF2';
const TEXT_MUTED = 'rgba(255, 255, 255, 0.65)';
const TEXT_FAINT = 'rgba(255, 255, 255, 0.40)';

// ── Glass Card Container ──
const PolicySectionCard = memo(
  ({
    icon,
    title,
    children,
  }: {
    icon: keyof typeof MaterialIcons.glyphMap;
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.cardWrapper}>
      <View style={styles.cardContainer}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(32, 28, 42, 0.88)' }]}
          />
        )}
        {/* Specular sheen */}
        <View style={styles.specular} pointerEvents="none" />
        {/* Border outline */}
        <View style={styles.cardBorder} pointerEvents="none" />

        <View style={styles.cardContent}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.iconBadge}>
              <MaterialIcons name={icon} size={18} color={PRIMARY} />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <View style={styles.sectionBody}>{children}</View>
        </View>
      </View>
    </View>
  )
);
PolicySectionCard.displayName = 'PolicySectionCard';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Atmospheric Background Gradient */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: BG }]} />
        <LinearGradient
          colors={['rgba(108, 55, 169, 0.14)', 'transparent', 'rgba(70, 34, 192, 0.10)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar with Back Button ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Privacy Policy</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ── Header Intro ── */}
        <View style={styles.headerBlock}>
          <Text style={styles.mainTitle}>Privacy & Data Transparency</Text>
          <Text style={styles.lastUpdated}>Last Updated: September 2026 • v0.1.0-beta</Text>
          <Text style={styles.introParagraph}>
            AuraMusic is built on a <Text style={styles.boldWhite}>local-first, account-free</Text> architecture.
            Your privacy is respected by design: no user accounts, no tracking profiles, and no intermediary
            collection servers. Below is an exact technical accounting of how data is stored, transmitted,
            and managed on your Android device.
          </Text>
        </View>

        {/* ── Section 1: Overview ── */}
        <PolicySectionCard icon="info" title="1. Overview">
          <Text style={styles.bodyText}>
            AuraMusic is a client-side Android music player providing high-fidelity streaming and offline
            playback. You do not need to create an account, register, or provide an email address to use
            AuraMusic&apos;s core playback and local file management features. For users who wish to browse and
            play their personal playlists from external platforms, AuraMusic offers an optional Connected
            Libraries feature (including YouTube Music via official Google Sign-In and Spotify via PKCE OAuth).
          </Text>
        </PolicySectionCard>

        {/* ── Section 2: Information Stored Locally ── */}
        <PolicySectionCard icon="storage" title="2. Information Stored Locally">
          <Text style={styles.bodyText}>
            All application data is maintained locally in private Android application storage:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>SQLite Database (`aura_music.db`):</Text> Manages your playlists,
              liked songs, cached track catalog metadata, listening history, and downloaded track references.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>AsyncStorage & Preferences (`aura_player_prefs`):</Text> Stores your
              custom settings such as streaming audio quality, download preferences, theme selections, volume
              normalization, and playback shuffle modes.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Offline Media Sandbox (`documentDirectory/aura/`):</Text> Downloaded
              audio files (`.mp3`) and album artwork (`.webp`) are stored directly in your app&apos;s isolated sandbox.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Local Playback Telemetry:</Text> Affinity metrics (play counts, skip
              frequencies, listening duration) are calculated purely on-device to power Discover recommendations.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 3: Network Requests ── */}
        <PolicySectionCard icon="wifi" title="3. Network Requests">
          <Text style={styles.bodyText}>
            AuraMusic makes outbound network requests only to fulfill core user-initiated actions:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>YouTube & Google CDN:</Text> Music catalog search, artist/album
              metadata, and streaming audio playback chunks are fetched directly from public YouTube Music endpoints.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>LRCLIB API:</Text> Synchronized and unsynced lyrics are retrieved in
              real-time using the song&apos;s canonical title, artist, and duration.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>No Backend Intermediary:</Text> AuraMusic does not route your network
              requests through any proprietary server. All API requests originate directly from your device.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 4: Downloads and Storage Isolation ── */}
        <PolicySectionCard icon="folder-special" title="4. Downloads and Storage Isolation">
          <Text style={styles.bodyText}>
            Downloaded tracks and cached artwork are stored in AuraMusic&apos;s private Android sandbox:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • Audio files are saved to <Text style={styles.codeText}>/files/aura/audio/</Text> and artwork to{' '}
              <Text style={styles.codeText}>/files/aura/artwork/</Text>.
            </Text>
            <Text style={styles.bulletItem}>
              • Android&apos;s application sandbox prevents other non-root applications from accessing your downloaded
              audio files.
            </Text>
            <Text style={styles.bulletItem}>
              • If you uninstall AuraMusic, the Android operating system permanently deletes all sandboxed files
              and databases.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 5: Analytics and Diagnostics ── */}
        <PolicySectionCard icon="security" title="5. Analytics & Zero Third-Party Tracking">
          <Text style={styles.bodyText}>
            AuraMusic contains <Text style={styles.boldWhite}>NO</Text> third-party analytics SDKs, advertising
            trackers, or user profiling tools:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>• No Google Analytics, Firebase Analytics, or Mixpanel SDKs.</Text>
            <Text style={styles.bulletItem}>• No Facebook SDK or advertising identifiers (IDFA/GAID).</Text>
            <Text style={styles.bulletItem}>• No behavioral data is sold, monetized, or shared with third parties.</Text>
            <Text style={styles.bulletItem}>
              • Internal performance metrics (such as frame timing diagnostics in development) run entirely in
              volatile device memory and are never uploaded.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 6: Android Backup Rules ── */}
        <PolicySectionCard icon="cloud-sync" title="6. Android Auto Backup Configuration">
          <Text style={styles.bodyText}>
            AuraMusic configures Android&apos;s official Auto Backup system via explicit XML rules:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Included in Backup:</Text> Your Room database (`aura_music.db`,
              `-wal`, `-shm`), AsyncStorage stores, and user preferences (`aura_player_prefs.xml`). This preserves
              your playlists, favorites, and settings across device upgrades.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Excluded from Backup:</Text> Audio files, album art, and temporary
              media caches are strictly excluded, keeping the total backup footprint under 1 MB.
            </Text>
            <Text style={styles.bulletItem}>
              • Cloud backup requires system-level encryption capabilities (<Text style={styles.codeText}>disableIfNoEncryptionCapabilities=&quot;true&quot;</Text>).
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 7: Optional Connected Services (YouTube Music & Google Sign-In) ── */}
        <PolicySectionCard icon="vpn-key" title="7. Optional Connected Services — YouTube Music & Google Sign-In">
          <Text style={styles.bodyText}>
            AuraMusic includes an optional Connected Libraries feature that allows you to connect your Google
            account to import and browse your personal YouTube Music playlists directly in your library:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>YouTube API Services:</Text> AuraMusic uses official Google Sign-In
              and YouTube API Services. By connecting your account, you acknowledge and agree to be bound by the{' '}
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL('https://www.youtube.com/t/terms').catch(() => {})}
              >
                YouTube Terms of Service
              </Text>{' '}
              and the{' '}
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL('https://policies.google.com/privacy').catch(() => {})}
              >
                Google Privacy Policy
              </Text>.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Requested Scope:</Text> AuraMusic requests only the minimum read-only
              OAuth scope required to display your playlists:{' '}
              <Text style={styles.codeText}>https://www.googleapis.com/auth/youtube.readonly</Text>.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Accessed Information:</Text> Only your Google account display name or
              email (for identification in the Connected Apps UI), your personal playlist metadata (IDs, titles,
              artwork URLs, and item counts), and constituent track details (video IDs, titles, thumbnails, and durations)
              are accessed. AuraMusic never sees, handles, or stores your Google password.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Token Handling & Storage:</Text> Google OAuth 2.0 access tokens are
              managed natively in volatile memory by Google Play Services on your Android device. Tokens are NEVER
              stored in AuraMusic&apos;s Room SQLite database, AsyncStorage, SecureStore, or any developer server. AuraMusic
              explicitly sets offlineAccess to false, meaning no refresh tokens exist on your device.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Local Caching & 30-Day Retention:</Text> In compliance with YouTube
              API Services Developer Policies (Section III.D), cached playlist metadata and track references are
              retained on-device for a maximum of 30 calendar days. Any cached data that cannot be verified or
              refreshed within 30 days is deterministically purged.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>In-App Disconnect & Programmatic Revocation:</Text> You can disconnect
              YouTube Music at any time via Settings → Connected Apps. Disconnecting attempts programmatic OAuth
              revocation via Google Play Services, terminates the local authentication session, and permanently deletes all
              imported YouTube playlists and cached track listings from your device. If device network connectivity prevents
              immediate server-side revocation confirmation, AuraMusic alerts the user and provides a direct link to Google
              Account Security Settings to verify or revoke access manually.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Google Security Settings Revocation:</Text> You can also revoke
              AuraMusic&apos;s access directly at any time from{' '}
              <Text
                style={styles.linkText}
                onPress={() => Linking.openURL('https://myaccount.google.com/permissions').catch(() => {})}
              >
                Google Account Security Settings
              </Text>.
              When authorization is revoked externally, AuraMusic detects the revocation, transitions the service to
              expired status, and immediately purges all cached YouTube Authorized Data.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 8: General Outbound Network Requests ── */}
        <PolicySectionCard icon="dns" title="8. General Outbound Network Requests">
          <Text style={styles.bodyText}>
            When streaming media or fetching lyrics, AuraMusic communicates directly with upstream endpoints (YouTube
            content CDN and LRCLIB). Standard network transport metadata (such as your IP address and device User-Agent)
            is transmitted as required by HTTP protocols. Consult the respective privacy documentation of Google and
            LRCLIB for their connection policies.
          </Text>
        </PolicySectionCard>

        {/* ── Section 9: Data Retention & User Controls ── */}
        <PolicySectionCard icon="delete-sweep" title="9. Data Retention & User Controls">
          <Text style={styles.bodyText}>
            You have full control over your stored data directly inside AuraMusic:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Clear Song Cache:</Text> Available in Settings → Storage & Cache.
              Immediately wipes cached audio chunks and artwork.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Delete Downloads:</Text> Individual tracks can be deleted from the
              Downloads tab, or wiped entirely via Settings → Clear Downloads.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Delete Playlists:</Text> Custom playlists and liked tracks can be
              edited or removed at any time from the Library tab.
            </Text>
            <Text style={styles.bulletItem}>
              • <Text style={styles.boldWhite}>Disconnect Connected Libraries:</Text> Settings → Connected Apps.
              Attempts to revoke OAuth authorization programmatically, clears locally stored connected-library data,
              and provides a link to Google Account Security Settings if remote revocation cannot be confirmed because
              the device is offline.
            </Text>
          </View>
        </PolicySectionCard>

        {/* ── Section 10: Children's Privacy ── */}
        <PolicySectionCard icon="child-care" title="10. Children's Privacy">
          <Text style={styles.bodyText}>
            AuraMusic is a general-audience audio utility. It does not solicit, collect, or store personal
            identifying information from any user, including children under 13 years of age.
          </Text>
        </PolicySectionCard>

        {/* ── Section 11: Policy Updates ── */}
        <PolicySectionCard icon="update" title="11. Changes to This Policy">
          <Text style={styles.bodyText}>
            Any future adjustments reflecting architecture or feature changes will be published directly within
            application releases with an updated date.
          </Text>
        </PolicySectionCard>

        {/* ── Section 12: Contact & Project Info ── */}
        <PolicySectionCard icon="code" title="12. Project Information">
          <Text style={styles.bodyText}>
            AuraMusic is a source-available personal software project developed for technical research, education,
            and Android audio experimentation. Source code, issue tracking, and technical inquiries are available
            via the project&apos;s official GitHub repository.
          </Text>
        </PolicySectionCard>

        {/* Footer Brand */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerBrandText}>Aura Music</Text>
          <Text style={styles.footerSubText}>Local-First · Private by Design · Open Architecture</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  headerBlock: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  lastUpdated: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    marginTop: 6,
    marginBottom: 12,
  },
  introParagraph: {
    fontSize: 13.5,
    lineHeight: 20,
    color: TEXT_MUTED,
  },
  boldWhite: {
    fontWeight: '700',
    color: '#FFF',
  },
  codeText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontSize: 12,
    color: '#46F5E0',
  },

  // ── Card Styles ──
  cardWrapper: {
    marginBottom: 14,
  },
  cardContainer: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 2,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardContent: {
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(191, 90, 242, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.2,
  },
  sectionBody: {
    paddingLeft: 4,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_MUTED,
  },
  bulletList: {
    marginTop: 8,
    gap: 7,
  },
  bulletItem: {
    fontSize: 12.5,
    lineHeight: 18,
    color: TEXT_MUTED,
  },
  linkText: {
    color: '#DAB9FF',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },

  // ── Footer ──
  footerBrand: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  footerBrandText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  footerSubText: {
    fontSize: 11,
    color: TEXT_FAINT,
  },
});

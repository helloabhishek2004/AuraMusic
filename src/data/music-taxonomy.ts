/**
 * AuraMusic — Canonical Music Taxonomy & Offline Discovery Catalog
 *
 * Grounded in real YouTube Music catalog queries and entity indexing.
 * Provides instant 0ms offline availability for first-run onboarding.
 */

import { LanguageItem, GenreItem, OnboardingArtist } from '../features/taste-profile/types/taste-profile';

export const MUSIC_LANGUAGES: LanguageItem[] = [
  { id: 'english', name: 'English', nativeName: 'English', searchTag: 'Global Top Hits' },
  { id: 'hindi', name: 'Hindi', nativeName: 'हिन्दी', searchTag: 'Top Hindi Songs' },
  { id: 'malayalam', name: 'Malayalam', nativeName: 'മലയാളം', searchTag: 'Top Malayalam Songs' },
  { id: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', searchTag: 'Top Tamil Hits' },
  { id: 'telugu', name: 'Telugu', nativeName: 'తెలుగు', searchTag: 'Top Telugu Songs' },
  { id: 'punjabi', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', searchTag: 'Top Punjabi Hits' },
  { id: 'kannada', name: 'Kannada', nativeName: 'ಕನ್ನಡ', searchTag: 'Top Kannada Songs' },
  { id: 'bengali', name: 'Bengali', nativeName: 'বাংলা', searchTag: 'Top Bengali Songs' },
  { id: 'marathi', name: 'Marathi', nativeName: 'मराठी', searchTag: 'Top Marathi Hits' },
  { id: 'gujarati', name: 'Gujarati', nativeName: 'ગુજરાતી', searchTag: 'Top Gujarati Songs' },
  { id: 'bhojpuri', name: 'Bhojpuri', nativeName: 'भोजपुरी', searchTag: 'Top Bhojpuri Hits' },
  { id: 'urdu', name: 'Urdu', nativeName: 'اردو', searchTag: 'Top Urdu Songs' },
  { id: 'arabic', name: 'Arabic', nativeName: 'العربية', searchTag: 'Top Arabic Hits' },
  { id: 'korean', name: 'K-Pop', nativeName: '한국어', searchTag: 'Top K-Pop Hits' },
  { id: 'japanese', name: 'Japanese', nativeName: '日本語', searchTag: 'J-Pop Hits' },
  { id: 'spanish', name: 'Spanish', nativeName: 'Español', searchTag: 'Top Latin Hits' },
  { id: 'french', name: 'French', nativeName: 'Français', searchTag: 'French Pop Hits' },
  { id: 'german', name: 'German', nativeName: 'Deutsch', searchTag: 'German Pop Hits' },
  { id: 'portuguese', name: 'Portuguese', nativeName: 'Português', searchTag: 'Top Portuguese Hits' },
  { id: 'turkish', name: 'Turkish', nativeName: 'Türkçe', searchTag: 'Top Turkish Hits' },
  { id: 'italian', name: 'Italian', nativeName: 'Italiano', searchTag: 'Italian Pop Hits' },
  { id: 'russian', name: 'Russian', nativeName: 'Русский', searchTag: 'Top Russian Hits' },
  { id: 'chinese', name: 'Mandarin', nativeName: '中文', searchTag: 'Top C-Pop Hits' },
];

export const MUSIC_GENRES: GenreItem[] = [
  {
    id: 'pop',
    name: 'Pop Hits',
    icon: 'musical-notes',
    gradient: ['#FF2D55', '#FF375F'],
    searchQuery: 'Top Pop Hits',
    description: 'Catchy hooks, chartbusters, and modern melodies',
  },
  {
    id: 'hiphop',
    name: 'Hip-Hop & Rap',
    icon: 'mic',
    gradient: ['#FF9500', '#FF3B30'],
    searchQuery: 'Top Hip Hop Rap Hits',
    description: 'Fresh flow, 808 beats, and urban storytelling',
  },
  {
    id: 'indie',
    name: 'Indie & Alt',
    icon: 'sparkles',
    gradient: ['#30D158', '#34C759'],
    searchQuery: 'Indie Rock Alternative Hits',
    description: 'Heartfelt songwriting and alternative discoveries',
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    icon: 'flash',
    gradient: ['#BF5AF2', '#5E5CE6'],
    searchQuery: 'Synthwave Retrowave Chill Electro',
    description: 'Neon retro synthesis, driving bass, and 80s nostalgia',
  },
  {
    id: 'lofi',
    name: 'Lo-Fi Chill',
    icon: 'cafe',
    gradient: ['#64D2FF', '#0A84FF'],
    searchQuery: 'Lofi Hip Hop Chill Beats to Relax Study',
    description: 'Mellow grooves, warm vinyl crackle, and focus beats',
  },
  {
    id: 'edm',
    name: 'EDM & Dance',
    icon: 'pulse',
    gradient: ['#FFD60A', '#FF9F0A'],
    searchQuery: 'Dance EDM Electronic Festival Hits',
    description: 'High octane energy, festival anthems, and drops',
  },
  {
    id: 'acoustic',
    name: 'Acoustic',
    icon: 'heart-outline',
    gradient: ['#AC8E68', '#8E6E45'],
    searchQuery: 'Acoustic Pop Chill Coffeehouse',
    description: 'Intimate unplugged guitar, piano, and raw vocals',
  },
  {
    id: 'classical',
    name: 'Classical & Instrumental',
    icon: 'library',
    gradient: ['#E5E5EA', '#8E8E93'],
    searchQuery: 'Classical Piano Orchestral Instrumental',
    description: 'Timeless compositions, cinematic strings, and piano',
  },
  {
    id: 'rnb',
    name: 'R&B & Soul',
    icon: 'heart',
    gradient: ['#FF2D55', '#AF52DE'],
    searchQuery: 'RnB Soul Chill Hits',
    description: 'Smooth harmonies, emotional depth, and groove',
  },
  {
    id: 'rock',
    name: 'Rock & Metal',
    icon: 'flame',
    gradient: ['#FF453A', '#8E0000'],
    searchQuery: 'Rock Metal Classics Hits',
    description: 'Electric riffs, stadium drums, and timeless power',
  },
  {
    id: 'bollywood',
    name: 'Bollywood & Film',
    icon: 'film',
    gradient: ['#FF9500', '#FF2D55'],
    searchQuery: 'Bollywood Chartbusters',
    description: 'Cinematic romance, dance anthems, and iconic soundscapes',
  },
  {
    id: 'devotional',
    name: 'Devotional & Ambient',
    icon: 'sunny',
    gradient: ['#FFD60A', '#FF9500'],
    searchQuery: 'Peaceful Devotional Ambient Music',
    description: 'Soulful chants, spiritual serenity, and peace',
  },
];

export interface CuratedArtistEntry extends OnboardingArtist {
  languages: string[];
  genres: string[];
}

export const CURATED_DISCOVERY_ARTISTS: CuratedArtistEntry[] = [
  // Global / English Pop & R&B
  {
    id: 'UClYV6hHlupm_S_ObS1W-DYw',
    name: 'The Weeknd',
    artworkUrl: 'https://lh3.googleusercontent.com/U-SAmNOu4TynE818gLCfKsuHZ0U5YNEtO9mrjSI9WCCKERs98LzrCal5kajBBTQNwdcisoB2Bn-pHp4=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['pop', 'rnb', 'synthwave'],
  },
  {
    id: 'UCPC0L1d253x-KuMNwa05TpA',
    name: 'Taylor Swift',
    artworkUrl: 'https://yt3.googleusercontent.com/RCpTA6EXJQyjVFDosWOKa2SMmqkua_lA9mHPDWWciLwgqpZLz-k8rXWRF_367trrQ7up9BUwCbk6kRk=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['pop', 'acoustic', 'indie'],
  },
  {
    id: 'UCERrDZ8oN0U_n9MphMKERcg',
    name: 'Billie Eilish',
    artworkUrl: 'https://lh3.googleusercontent.com/tQC4rOL6xz6FhmFr0ggQExxyGbYSOsyveXVSnPBh2WjEyIzQ9pMHablLJ-0GlMBrLBlBrbWQGmzrV6KN=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['pop', 'indie', 'rnb'],
  },
  {
    id: 'UClmXPfaYhXOYsNn_QUyheWQ',
    name: 'Ed Sheeran',
    artworkUrl: 'https://lh3.googleusercontent.com/jQoBIAS6JjFGpcqQY1M_Mh3AasOvFENCdVRxkgax1a0K6qiq7AgE3MbJ6Jtt-Jndcarvoawmrg66KTny=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['pop', 'acoustic'],
  },
  {
    id: 'UCzVb0SIXp9q9PeKCcFjsBtA',
    name: 'Dua Lipa',
    artworkUrl: 'https://lh3.googleusercontent.com/aFx8s1fTuelgxONGbezmTG0EKR8r82uB5H-Q6ZJtssyCWLJWF8GfZNr4tHo84sXdFCPBKrA4R6zXOss=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['pop', 'edm'],
  },
  {
    id: 'UCIaFw5VBEK8qaW6nRpx_qnw',
    name: 'Coldplay',
    artworkUrl: 'https://lh3.googleusercontent.com/IOKuXtp8PCQ_Fc-vaRKm3sKIXBxFV51gZheLTH5br-YGnWHFQf_Jywcuk7wbprYRoEbQyS_XZY6-nMJX=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['rock', 'pop', 'indie'],
  },

  // Hindi & Bollywood
  {
    id: 'UCDxKh1gFWeYsqePvgVzmPoQ',
    name: 'Arijit Singh',
    artworkUrl: 'https://lh3.googleusercontent.com/W_yOqnKSDYyeVOY_AsXhuAtb6rW3vCL3GtJ9DA1GxWOrJfyeSOqzvTv_TkFHijdkVPXWutASBlRFPg=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi', 'bengali'],
    genres: ['bollywood', 'pop', 'acoustic'],
  },
  {
    id: 'UCrC-7fsdTCYeaRBpwA6j-Eg',
    name: 'Shreya Ghoshal',
    artworkUrl: 'https://yt3.googleusercontent.com/PgINZNe0qVxgMSXKG5vF82bNN4WCC12zgWsz9I7OLs4CLF9Cn0Vxq7Xc1ToupnzXrCv0nKfe3VM=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi', 'malayalam', 'tamil', 'telugu', 'bengali'],
    genres: ['bollywood', 'classical', 'pop'],
  },
  {
    id: 'UCCTN01plFzn4npREHKT2_9Q',
    name: 'Pritam',
    artworkUrl: 'https://yt3.googleusercontent.com/sjGMYJQ1J3FZEIBsMYUztMjjYOM4-NJ24CjmIHqxTWCxAM1YgjL-d_17u7_PRhTouOwwAjbu-2x5S6I=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi'],
    genres: ['bollywood', 'pop', 'rock'],
  },
  {
    id: 'UCo36OSM_dp0KynQ02zibnsQ',
    name: 'Anuv Jain',
    artworkUrl: 'https://lh3.googleusercontent.com/CAu3xx6p8BwER8QaY0YDJBBhROtJJbrm-NZwL97zhZjZkwipdUDSZXL1WWdWVD1X9FyQFFpwmOj-WQ=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi'],
    genres: ['indie', 'acoustic', 'pop'],
  },
  {
    id: 'UC25UGbOHCuT5Jht2ItRXTqQ',
    name: 'Vishal Mishra',
    artworkUrl: 'https://yt3.googleusercontent.com/CkSBKxmPT_97r-CR5HPGrTzZef53Li3Zgv5S8MLajtLFTrYWejm3lvJqB15bjhqYaw5pvkzR=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi'],
    genres: ['bollywood', 'acoustic', 'pop'],
  },

  // Malayalam
  {
    id: 'UCzpmF_8698JYBqh96PPCTfw',
    name: 'Sushin Shyam',
    artworkUrl: 'https://yt3.googleusercontent.com/YlcHWu5-x5LKoVkv80_D533SdNG_mly1WtLAkcUcFwuVGWSHgU_q-3-SFQgj8XXg8q8UZXPacg=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['malayalam'],
    genres: ['indie', 'electronic', 'rock', 'pop'],
  },
  {
    id: 'UC0aV0qinwdUmB2NuEhfRS_w',
    name: 'Hesham Abdul Wahab',
    artworkUrl: 'https://yt3.ggpht.com/ytc/AIdro_mjy1zj7IVDhdBMkrH-Q4YBuXnatZ6iLMXLIrLE9fDxOg=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['malayalam', 'telugu'],
    genres: ['pop', 'acoustic', 'classical'],
  },
  {
    id: 'UCi_tU7Hk8RjbffAxpjBYvCg',
    name: 'K. S. Harisankar',
    artworkUrl: 'https://yt3.ggpht.com/ytc/AIdro_m1BynvBFb52BYjixx0qIygoVxxw9MfxF1fehzhdAR15Bw=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['malayalam'],
    genres: ['classical', 'acoustic', 'pop'],
  },
  {
    id: 'UCghniYw4cUgWKaeeoik8WNg',
    name: 'Job Kurian',
    artworkUrl: 'https://yt3.googleusercontent.com/FsXkMIAKccYM06QO1Jf2hclBxIWZVQRUwNdAmvseGevJZm1b7wTv9E8dpJtdd7YyFeE9d0OSzlwQF_8=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['malayalam'],
    genres: ['indie', 'acoustic', 'rock'],
  },
  {
    id: 'UC8TXnDE17HVa8j2Ko6glyAQ',
    name: 'When Chai Met Toast',
    artworkUrl: 'https://yt3.googleusercontent.com/ibAp6t2UTu5RzM_Ut-j_EdQE2Ps7odiBGcR6PalSSiIeKSt0rM-vEWFcDwSs4HMiMA76yHg-8OSnNzM=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english', 'hindi', 'malayalam'],
    genres: ['indie', 'acoustic', 'pop'],
  },

  // Tamil
  {
    id: 'UCbRSywya_rl8YS15Lo9ttsA',
    name: 'Anirudh Ravichander',
    artworkUrl: 'https://lh3.googleusercontent.com/wBG4jypwBcEGHd-qSbM2_4B46WPEhlOCjusCOEkxdnsoIC4WLS9LmFARZsE854pB-vAEYlsp4x2yiHE=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['tamil', 'telugu', 'hindi'],
    genres: ['pop', 'edm', 'hiphop', 'rock'],
  },
  {
    id: 'UCtJe0RYzgPddQXKtWduxz_w',
    name: 'A.R. Rahman',
    artworkUrl: 'https://yt3.googleusercontent.com/vHMOuDn8gr3SW9Pm8yFgmtYzM5kj4ayng5HKRjW0OyjG9mPK923XMVtTZTt4NUG_1aemWNLSQ27zjtA=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['tamil', 'hindi', 'english'],
    genres: ['classical', 'bollywood', 'pop', 'electronic'],
  },
  {
    id: 'UCQXg6kTstIOwbrjBwE3IlDw',
    name: 'Yuvan Shankar Raja',
    artworkUrl: 'https://lh3.googleusercontent.com/-IRVL5B0n7-V9Gh9XZvQG161HYqkH_SNSHfJwWYeIcVVh35sMq9-jHTk1FCeAmeUHSdEq7UMpoVzUPw=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['tamil'],
    genres: ['pop', 'hiphop', 'electronic'],
  },
  {
    id: 'UC7_KgmSrwM247k2lnh5GhHw',
    name: 'Sid Sriram',
    artworkUrl: 'https://yt3.googleusercontent.com/Ip35qauI_vMztXkJ3Wd6etvLwiyRrHIGvDyKK3714vyWMBx1ogHxPxkA8ohPnOLyy68wzEVBblPmsHHU=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['tamil', 'telugu', 'malayalam'],
    genres: ['rnb', 'acoustic', 'classical'],
  },

  // Punjabi
  {
    id: 'UCJ2m-WpROlZCiZZID9r7NSQ',
    name: 'Diljit Dosanjh',
    artworkUrl: 'https://yt3.googleusercontent.com/7EYXXMXY594V8y4sZT2aawmdKgDAGTu5jNm9C-HpR3jY9cZJ0NMxS__nZKBdWZ1PUpJPjc2BAA=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['punjabi'],
    genres: ['pop', 'hiphop', 'edm'],
  },
  {
    id: 'UCQmNiXx378nooDuZPA2fTAg',
    name: 'AP Dhillon',
    artworkUrl: 'https://lh3.googleusercontent.com/yJh1MZL2FvtJz3YeDAUhTRpfdUSwdotWw8XmB_An-4coKiVG4pDpUGRAPV7ooqmzBP4HAWrtjPyAfI4=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['punjabi'],
    genres: ['hiphop', 'rnb', 'synthwave'],
  },
  {
    id: 'UCSmK5WX5U4gdtebWjoL81og',
    name: 'Karan Aujla',
    artworkUrl: 'https://lh3.googleusercontent.com/k7sgqqcV5VScaMZtTmS8W_tfouLVBpgyJII0epYE2Vjw1-zzhGgUCV51aHxZn6cmZKKJgUfNlIVpZg=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['punjabi'],
    genres: ['hiphop', 'pop'],
  },

  // Hip-Hop (Global & Desi)
  {
    id: 'UCprAFmT0C6O4X0ToEXpeFTQ',
    name: 'Kendrick Lamar',
    artworkUrl: 'https://yt3.googleusercontent.com/uB8Magh99SvDyT_mcDYeNYxlVZ_F9WN-cJtAFMHw_Q-_N_8y5-uZiay8-EZSKKloNoWxymBzVehSF4PN=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['hiphop'],
  },
  {
    id: 'UCKmB5zwbEfmx4hqdTjLHDfQ',
    name: 'DIVINE',
    artworkUrl: 'https://lh3.googleusercontent.com/RaYF_XJtrT829WF9RNApYYC6Pd9plxjNHwvUVQoGZDFLNe9bixlQdlmHSIy0CT-S96JAC4ARXgm5nsz5=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi'],
    genres: ['hiphop'],
  },
  {
    id: 'UCL0-89BZ7NWvJfmwDunDJ-A',
    name: 'Seedhe Maut',
    artworkUrl: 'https://yt3.googleusercontent.com/DUcKt_1YaJ_48_T_hlxWg285BGKkTfwNdzKRV82G-gHZVerUQ8FD8Dl2hkqHLUirrJDnG4C3RA=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['hindi'],
    genres: ['hiphop'],
  },

  // Synthwave & Electronic
  {
    id: 'UC3V5kzHK2r4rbbXlf4OpFmw',
    name: 'Kavinsky',
    artworkUrl: 'https://yt3.googleusercontent.com/3Yd_Jbi64HiwBXOiL6Zpk_tnTtjREI2Ct77MvoD5vHLjY_v1lproDZlALV09Z8nJq5cRn7h990btV2Gc=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english', 'french'],
    genres: ['synthwave', 'edm'],
  },
  {
    id: 'UCkhnqwH8DtT0Ap3A-mi_GJQ',
    name: 'The Midnight',
    artworkUrl: 'https://lh3.googleusercontent.com/4ZMGbaVlNXpNFylJPKDLVKxF2zlM73TJ7WqE9u5V5pyz0pXXmDQyd0zA73EfAg6G-1TYGIZRQEauTo8=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['synthwave', 'indie', 'pop'],
  },
  {
    id: 'UCqJnSdHjKtfsrHi9aI-9d3g',
    name: 'Martin Garrix',
    artworkUrl: 'https://lh3.googleusercontent.com/HVjzD5hZ602Mj8NKuSZRIgCFgQOm60q65Ki42aqgsfWSxAswO4990hUUG3ksQLxYW2yzKtJVvXQ5A8w=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['edm', 'pop'],
  },

  // Rock & Alternative
  {
    id: 'UCxgN32UVVztKAQd2HkXzBtw',
    name: 'Linkin Park',
    artworkUrl: 'https://lh3.googleusercontent.com/uE72emEZFH3TVtCZoIFYKmnf7vsb42RYQxb4X-lonyqPQuS_mLtKpLfBQ5JdHwUijfQo06BtSB7LoQ=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['rock', 'metal', 'hiphop'],
  },
  {
    id: 'UC0aXrjVxG5pZr99v77wZdPQ',
    name: 'Imagine Dragons',
    artworkUrl: 'https://lh3.googleusercontent.com/TAadzeojHFGU1EJ5jnOWDn6K8Cf8O2x0F04PVxnZwUEhcaYN0pA0dic49VU7OKGs7oovBTylWx70xhY=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['english'],
    genres: ['rock', 'pop', 'indie'],
  },

  // Regional & Global Curated Discoveries
  {
    id: 'UCz_0K90J-h_v2J3wU0Z7x0A',
    name: 'Ajay-Atul',
    artworkUrl: 'https://lh3.googleusercontent.com/4qK4W7d6QyMvQ2H6g8pD6b2b5xN3zY8Q=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['marathi', 'hindi'],
    genres: ['bollywood', 'classical'],
  },
  {
    id: 'UC_sachin_jigar_id',
    name: 'Sachin-Jigar',
    artworkUrl: 'https://lh3.googleusercontent.com/Xw6M_Y8qQ4Z=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['gujarati', 'hindi'],
    genres: ['bollywood', 'pop'],
  },
  {
    id: 'UC_pawan_singh_id',
    name: 'Pawan Singh',
    artworkUrl: 'https://lh3.googleusercontent.com/V8w5g9_pawan=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['bhojpuri'],
    genres: ['folk', 'pop'],
  },
  {
    id: 'UC_atif_aslam_id',
    name: 'Atif Aslam',
    artworkUrl: 'https://lh3.googleusercontent.com/2Y4xW9t5zY=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['urdu', 'hindi', 'punjabi'],
    genres: ['pop', 'acoustic', 'bollywood'],
  },
  {
    id: 'UC_amr_diab_id',
    name: 'Amr Diab',
    artworkUrl: 'https://lh3.googleusercontent.com/diab_amr=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['arabic'],
    genres: ['pop', 'dance'],
  },
  {
    id: 'UC_rammstein_id',
    name: 'Rammstein',
    artworkUrl: 'https://lh3.googleusercontent.com/rammstein_art=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['german'],
    genres: ['metal', 'rock'],
  },
  {
    id: 'UC_anitta_id',
    name: 'Anitta',
    artworkUrl: 'https://lh3.googleusercontent.com/anitta_art=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['portuguese', 'spanish'],
    genres: ['pop', 'dance'],
  },
  {
    id: 'UC_maneskin_id',
    name: 'Måneskin',
    artworkUrl: 'https://lh3.googleusercontent.com/maneskin_art=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['italian', 'english'],
    genres: ['rock', 'indie'],
  },
  {
    id: 'UC_jay_chou_id',
    name: 'Jay Chou',
    artworkUrl: 'https://lh3.googleusercontent.com/jay_chou_art=w544-h544-p-l90-rj',
    source: 'curated',
    languages: ['chinese'],
    genres: ['pop', 'rnb'],
  },
];

/**
 * Filter curated artists by active languages and genres with high relevance
 */
export function getCuratedArtistSuggestions(
  selectedLanguages: string[],
  selectedGenres: string[]
): CuratedArtistEntry[] {
  const langSet = new Set(selectedLanguages.map(l => l.toLowerCase().trim()));
  const genreSet = new Set(selectedGenres.map(g => g.toLowerCase().trim()));

  const scored = CURATED_DISCOVERY_ARTISTS.map(artist => {
    let score = 0;
    for (const l of artist.languages) {
      if (langSet.has(l.toLowerCase())) score += 3;
    }
    for (const g of artist.genres) {
      if (genreSet.has(g.toLowerCase())) score += 2;
    }
    return { artist, score };
  });

  const matched = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.artist);

  // If fewer than 15 artists match, backfill with popular discovery artists to keep 3-col grid full
  if (matched.length < 15) {
    const seen = new Set(matched.map(a => a.id));
    for (const fallback of CURATED_DISCOVERY_ARTISTS) {
      if (!seen.has(fallback.id)) {
        matched.push(fallback);
        seen.add(fallback.id);
        if (matched.length >= 18) break;
      }
    }
  }

  return matched;
}

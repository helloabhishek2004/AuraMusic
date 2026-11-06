export type SeoRoute = 'home' | 'privacy' | 'terms';

export interface RouteSeoMetadata {
  route: SeoRoute;
  path: string;
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: 'website' | 'article';
  ogImage: string;
  ogImageAlt: string;
}

export const CANONICAL_ORIGIN = 'https://listenwith-auramusic.vercel.app';

export const ROUTE_SEO_CONFIG: Record<SeoRoute, RouteSeoMetadata> = {
  home: {
    route: 'home',
    path: '/',
    title: 'AuraMusic — Free, Ad-Free Offline Android Music Player',
    description:
      'Download AuraMusic for Android: a 100% free, ad-free offline music player with native Media3 audio, direct downloads, synced lyrics, and local library support.',
    keywords:
      'free music player for Android, music player with no ads, ad-free music player, offline music player Android, free offline music player, local music player Android, AuraMusic APK, AuraMusic v3.1.0 download, AndroidX Media3 music player',
    canonicalUrl: `${CANONICAL_ORIGIN}/`,
    ogType: 'website',
    ogImage: `${CANONICAL_ORIGIN}/aura_screen.png`,
    ogImageAlt: 'AuraMusic Android application interface with Liquid Glass design and native Media3 audio engine',
  },
  privacy: {
    route: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy — AuraMusic Ad-Free Android Music Player',
    description:
      'Read the AuraMusic Privacy Policy: zero telemetry, zero advertising SDKs, local on-device SQLite and MediaStore processing, and complete sandbox isolation.',
    keywords:
      'AuraMusic privacy policy, zero telemetry music player, private Android music player, no tracking offline music app, GDPR DPDP CCPA compliant music player',
    canonicalUrl: `${CANONICAL_ORIGIN}/privacy`,
    ogType: 'article',
    ogImage: `${CANONICAL_ORIGIN}/aura_screen.png`,
    ogImageAlt: 'AuraMusic Privacy Policy — Zero Telemetry & On-Device Audio Architecture',
  },
  terms: {
    route: 'terms',
    path: '/terms',
    title: 'Terms of Service — AuraMusic Android Music Player',
    description:
      'Review the official AuraMusic Terms of Service covering source-available licensing, personal Android APK usage, local media playback, and legal disclaimers.',
    keywords:
      'AuraMusic terms of service, AuraMusic license, source-available Android music player terms, Abhishek AuraMusic legal',
    canonicalUrl: `${CANONICAL_ORIGIN}/terms`,
    ogType: 'article',
    ogImage: `${CANONICAL_ORIGIN}/aura_screen.png`,
    ogImageAlt: 'AuraMusic Terms of Service — Official Legal Documentation',
  },
};

export function getRouteSeoMetadata(route: SeoRoute, currentOrigin?: string): RouteSeoMetadata {
  const base = ROUTE_SEO_CONFIG[route] || ROUTE_SEO_CONFIG.home;
  const origin =
    currentOrigin && currentOrigin.startsWith('http') && !currentOrigin.includes('localhost')
      ? currentOrigin.replace(/\/$/, '')
      : CANONICAL_ORIGIN;

  return {
    ...base,
    canonicalUrl: `${origin}${base.path}`,
  };
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function applyRouteSeo(route: SeoRoute): RouteSeoMetadata {
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  const meta = getRouteSeoMetadata(route, origin);

  if (typeof document !== 'undefined') {
    document.title = meta.title;
    upsertCanonicalLink(meta.canonicalUrl);

    upsertMetaTag('name', 'title', meta.title);
    upsertMetaTag('name', 'description', meta.description);
    upsertMetaTag('name', 'keywords', meta.keywords);

    upsertMetaTag('property', 'og:type', meta.ogType);
    upsertMetaTag('property', 'og:url', meta.canonicalUrl);
    upsertMetaTag('property', 'og:title', meta.title);
    upsertMetaTag('property', 'og:description', meta.description);
    upsertMetaTag('property', 'og:image', meta.ogImage);
    upsertMetaTag('property', 'og:image:alt', meta.ogImageAlt);

    upsertMetaTag('name', 'twitter:card', 'summary_large_image');
    upsertMetaTag('name', 'twitter:url', meta.canonicalUrl);
    upsertMetaTag('name', 'twitter:title', meta.title);
    upsertMetaTag('name', 'twitter:description', meta.description);
    upsertMetaTag('name', 'twitter:image', meta.ogImage);
    upsertMetaTag('name', 'twitter:image:alt', meta.ogImageAlt);
  }

  return meta;
}

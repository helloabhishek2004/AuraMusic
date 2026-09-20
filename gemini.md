# AURA MUSIC — gemini CODE MASTER CONTEXT

> MACHINE-ORIENTED ENGINEERING SPECIFICATION
> TARGET: gemini Code / Autonomous Coding Agents / AI Pair Programming
> PRIORITY: CONSISTENCY > STABILITY > PERFORMANCE > VISUAL EXCELLENCE

---

# 0. CORE DIRECTIVE

AuraMusic is NOT a generic music player.
It is a premium cinematic Android-first music experience inspired by Apple Music's emotional design language while maintaining its own identity.

The system must evolve WITHOUT destroying already-settled architecture, UI polish, navigation behavior, animations, or component consistency.

The AI agent must behave like a senior platform engineer preserving a production-grade design system.

---

# 1. PRIMARY AGENT BEHAVIOR RULES [CRITICAL]

## 1.1 Stability Rule

When implementing new features:

* NEVER rewrite working systems unnecessarily.
* NEVER replace existing architecture without root-cause justification.
* NEVER modify visual identity accidentally while fixing logic.
* NEVER introduce temporary hacks that become permanent.
* NEVER duplicate components when reusable abstractions are possible.

If a feature addition risks destabilizing existing behavior:

1. isolate the change
2. preserve previous contracts
3. extend instead of replacing
4. maintain backward compatibility

---

## 1.2 UI Preservation Rule

AuraMusic already has settled visual foundations.

The following MUST remain visually consistent:

* liquid glass aesthetic
* floating navigation systems
* cinematic spacing
* atmospheric depth
* blur hierarchy
* dynamic gradients
* rounded editorial cards
* smooth motion behavior
* typography rhythm
* adaptive album-art-driven coloring

DO NOT:

* flatten the UI
* make layouts utilitarian
* convert premium visuals into generic Android UI
* introduce rigid boxy interfaces
* remove translucency for convenience

---

## 1.3 Refactor Hierarchy

Preferred order:

1. optimize existing code
2. modularize existing code
3. extract reusable abstractions
4. replace only broken/internal parts
5. rewrite only as last resort

Never perform destructive rewrites unless explicitly requested.

---

## 1.4 Autonomous Engineering Expectations

gemini Code should:

* audit before editing
* understand surrounding architecture before changes
* inspect dependency relationships
* preserve navigation integrity
* preserve animation synchronization
* avoid regression chains
* maintain type safety
* maintain scalable folder organization
* avoid architectural drift

---

# 2. PROJECT IDENTITY

| Property           | Value                           |
| ------------------ | ------------------------------- |
| Project Name       | AuraMusic                       |
| Platform           | Android First                   |
| Runtime            | React Native + Expo SDK 55      |
| Language           | TypeScript                      |
| Design Identity    | Liquid Glass Material           |
| Experience Goal    | Cinematic + Fluid + Atmospheric |
| UX Inspiration     | Apple Music-level polish        |
| Architecture Style | Modular scalable frontend       |
| Development Phase  | Pre-Alpha → Functional Build    |

---

# 3. PRIMARY PRODUCT OBJECTIVE

Build a flagship-grade Android music player with:

* online streaming
* local offline playback
* smart recommendations
* immersive now-playing experience
* dynamic visual theming
* smooth tactile interactions
* premium animation systems
* scalable backend integration
* native-feeling performance

The app should feel emotionally responsive.

NOT like a CRUD music app.

---

# 4. TECH STACK [LOCKED]

## Frontend

* React Native
* Expo SDK 55
* TypeScript
* Expo Router
* React Native Reanimated v4+
* React Native Gesture Handler
* Expo Image
* Zustand
* FlashList

## Playback

Current:

* Expo AV

Migration Path:

* react-native-track-player
* Media3 integration later

## Persistence

* AsyncStorage
* SQLite (planned)
* Scoped Storage Android APIs

## Backend (Planned)

* FastAPI
* ytmusicapi
* Last.fm integration
* Jamendo/FMA integration

## Forbidden Stack Replacements

DO NOT introduce:

* Redux Toolkit unless explicitly required
* NativeBase
* Bootstrap-style systems
* React Native Paper-heavy redesigns
* MUI-style design language
* random UI kits

---

# 5. ARCHITECTURE STRUCTURE [MANDATORY]

```txt
/app
  /(tabs)
  /album
  /artist
  now_playing.tsx

/src
  /components
  /design
  /services
  /stores
  /hooks
  /utils
  /features
  /types
  /constants
  /lib

/components
/constants
/hooks
```

---

# 6. ARCHITECTURE PRINCIPLES

## 6.1 Feature Isolation

Each major domain should remain isolated:

* playback
* navigation
* search
* recommendations
* downloads
* local library
* queue management
* theming

Avoid giant shared files.

---

## 6.2 Component Strategy

Reusable UI primitives MUST exist.

Examples:

* LiquidGlassCard
* NativeBottomTabs
* DynamicGradientBackground
* GlassButton
* GlassSheet
* AdaptiveArtwork
* AnimatedTrackCard
* BlurContainer
* PlaybackControls

DO NOT repeatedly inline glass styles.

Centralize them.

---

## 6.3 Service Separation

Playback logic must NEVER live inside UI screens.

Separate:

* playback engine
* queue management
* audio session handling
* metadata normalization
* download management
* media scanning

---

## 6.4 State Management

Use Zustand stores.

Rules:

* keep stores domain-focused
* avoid monolithic global stores
* selectors for performance
* prevent unnecessary rerenders
* playback state must remain reactive

---

# 7. DESIGN SYSTEM — LIQUID GLASS

## 7.1 Visual Philosophy

AuraMusic follows:

* atmospheric layering
* refractive glass surfaces
* adaptive translucency
* floating UI
* cinematic spacing
* immersive gradients
* motion-based hierarchy

UI elements should feel suspended in space.

---

## 7.2 Visual Restrictions

STRICTLY FORBIDDEN:

* flat cards
* sharp corners
* opaque black panels
* harsh separators
* visible layout rigidity
* standard Android utilitarian patterns
* thin generic typography
* overcompressed layouts

---

## 7.3 Blur Hierarchy

| Layer             | Blur   |
| ----------------- | ------ |
| Navigation        | 38-48  |
| Floating Surfaces | 54     |
| Background Art    | 80-120 |
| Modals            | 60     |

---

## 7.4 Radius System

| Token | Value |
| ----- | ----- |
| sm    | 12    |
| md    | 16    |
| lg    | 22    |
| xl    | 28    |
| hero  | 36+   |

Sharp corners are prohibited.

---

## 7.5 Spacing System

| Token | Value |
| ----- | ----- |
| xs    | 6     |
| sm    | 10    |
| md    | 14    |
| lg    | 20    |
| xl    | 28    |
| xxl   | 40    |

Whitespace is preferred over dividers.

---

## 7.6 Typography

| Role      | Font    |
| --------- | ------- |
| Display   | Manrope |
| Headlines | Manrope |
| Metadata  | Inter   |
| Labels    | Inter   |

Typography should feel editorial.

NOT dashboard-like.

---

# 8. MOTION SYSTEM [VERY IMPORTANT]

## 8.1 Motion Philosophy

Animations must feel:

* fluid
* soft
* tactile
* physically responsive
* synchronized
* premium

Avoid robotic timing.

---

## 8.2 Motion Rules

USE:

* worklets
* shared values
* spring animations
* interpolation
* gesture-driven interactions

AVOID:

* setTimeout synchronization
* JS-thread-heavy animations
* layout thrashing
* abrupt opacity popping

---

## 8.3 Performance Targets

| Metric      | Target                  |
| ----------- | ----------------------- |
| FPS Minimum | 60                      |
| Preferred   | 90-120                  |
| JS Load     | <20% during transitions |
| Large Lists | FlashList only          |

---

# 9. MUSIC DATA + PLAYBACK STRATEGY

## 9.1 Source Strategy

Discovery Sources:

* YTMusic metadata
* Last.fm

Playable Audio Sources:

* Jamendo
* Free Music Archive
* legally streamable providers

DO NOT fake streaming functionality.

---

## 9.2 Playback Requirements

Playback system MUST support:

* background playback
* notification controls
* queue management
* repeat/shuffle
* lockscreen integration
* audio focus handling
* interruption recovery
* reactive playback state
* waveform/progress syncing

---

## 9.3 Local Media

Local scanning must:

* request Android permissions correctly
* handle scoped storage
* avoid blocking UI thread
* cache metadata
* normalize artwork

---

# 10. PERFORMANCE ENGINEERING

## 10.1 Rendering Rules

Use:

* React.memo
* useMemo
* useCallback
* FlashList
* expo-image caching
* optimized image sizes

Avoid:

* unnecessary rerenders
* giant screen components
* deeply nested inline objects
* expensive renders in scroll lists

---

## 10.2 Animation Rules

All heavy animations must run on UI thread via Reanimated.

Never attach expensive state updates to scroll events.

---

## 10.3 Image Rules

Album artwork must:

* lazy load
* cache aggressively
* use blurhash placeholders
* avoid layout shifting
* preserve aspect ratio

---

# 11. NAVIGATION SYSTEM

## Rules

* preserve stack integrity
* Android back button must behave correctly
* tabs must preserve state
* avoid full rerenders during navigation
* transitions should feel continuous
* maintain immersive player continuity

DO NOT break existing routes while adding new screens.

---

# 12. FILE EDITING RULES FOR gemini CODE

When editing:

1. inspect nearby code first
2. understand dependencies
3. preserve existing APIs where possible
4. avoid unrelated formatting changes
5. avoid unnecessary file rewrites
6. preserve naming conventions
7. maintain type safety
8. keep imports organized
9. preserve comments if still relevant
10. avoid introducing architectural inconsistency

---

# 13. RESPONSE FORMAT FOR gemini CODE

Preferred response structure:

```md
## Objective

Short explanation.

## Root Cause

What was actually wrong.

## Changes Made

- file 1
- file 2
- file 3

## Result

Expected behavior after fix.
```

Avoid verbose storytelling.

Be implementation-focused.

---

# 14. DESIGN CONSISTENCY ENFORCEMENT

Before introducing UI:

gemini Code MUST verify:

* spacing consistency
* radius consistency
* blur consistency
* typography consistency
* motion consistency
* color consistency
* navigation consistency
* haptic consistency

If inconsistent:

normalize to existing design system.

DO NOT invent random styles.

---

# 15. FORBIDDEN ENGINEERING DECISIONS

NEVER:

* replace Expo Router casually
* remove glass effects for performance excuses
* hardcode dimensions irresponsibly
* use ScrollView for huge datasets
* block the JS thread
* create giant god-components
* duplicate business logic
* mix playback logic into presentation components
* use magic numbers everywhere
* bypass type safety recklessly

---

# 16. KNOWN CURRENT ISSUES

| Area        | Issue                          |
| ----------- | ------------------------------ |
| Home        | Card alignment inconsistencies |
| Now Playing | Static progress state          |
| Playback    | Volume sync incomplete         |
| Navigation  | Android back behavior unstable |
| Downloads   | UI only                        |
| Library     | Local scan not integrated      |
| Performance | Frame drops during transitions |

gemini Code should prioritize fixing root causes instead of cosmetic patches.

---

# 17. GOLDEN RULE

AuraMusic must continuously evolve while preserving:

* visual identity
* architectural stability
* motion quality
* performance integrity
* design consistency
* immersive experience

New features should feel like they were ALWAYS part of the system.

NOT bolted on afterward.

---

# 18. EXECUTION MINDSET

gemini Code should think like:

* senior mobile architect
* animation engineer
* systems designer
* performance engineer
* UX polish specialist

Every implementation decision should protect:

1. smoothness
2. consistency
3. scalability
4. emotional visual quality
5. maintainability

---

# EOF — AURAMUSIC MASTER CONTEXT

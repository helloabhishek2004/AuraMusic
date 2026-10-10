# Google Analytics 4 (GA4) Integration & Tracking Guide

This website is integrated with Google Analytics 4 (GA4) with custom event tracking for user actions, conversions, downloads, and social traffic.

---

## 1. Quick Setup

1. Copy or edit `website/.env` (or add to your Vercel Project Environment Variables):
   ```bash
   VITE_GA_MEASUREMENT_ID="G-XXXXXXXXXX"
   ```
2. Replace `G-XXXXXXXXXX` with your GA4 Measurement ID from the Google Analytics dashboard:
   - Navigate to **Google Analytics** &rarr; **Admin** &rarr; **Data Streams** &rarr; **Web Stream**.
   - Copy the **Measurement ID** (`G-...`).
3. Run or deploy:
   ```bash
   npm run dev      # Test locally (events log to browser console in DEV mode)
   npm run build    # Production build
   ```

---

## 2. Tracked Events & Metrics

All events are strongly typed in [`src/lib/analytics.ts`](./src/lib/analytics.ts) and fire asynchronously with safe fallbacks.

| Objective / Metric | GA4 Event Name | Parameters | Where Triggered |
|---|---|---|---|
| **Visitors & Pageviews** | `page_view` | `page_path`, `page_title`, `page_location` | Initial load, SPA route transitions (`/`, `/privacy`, `/terms`) |
| **APK Downloads** | `download_apk` & `file_download` | `version`, `apk_name`, `source` | Hero download button, Nav "Get Aura", Download section, mobile drawer, mock player |
| **Page / Section Redirects** | `page_redirect` | `destination`, `redirect_type` (`internal_nav` / `route_change`) | Navbar links, Footer links, Legal links, CTA scroll buttons |
| **GitHub Visits** | `github_visit` & `outbound_click` | `source`, `url` | Header GitHub link, Hero CTA, Releases button, Footer, Creator Story |
| **Portfolio Visits** | `portfolio_visit` & `outbound_click` | `source`, `url` | Creator Story "Portfolio" button, Footer "Portfolio" link |
| **Socials & Support Visits** | `social_visit` & `outbound_click` | `platform`, `source`, `url` | "Buy me a coffee" in Creator Story and Footer |
| **Track Skipped** | `track_skipped` | `direction` (`prev`/`next`), `track_title`, `component_source` | Hero player previous/next buttons, Showcase interactive player skip buttons |
| **Shared The Link** | `share` & `share_link` | `method` (`native_share`/`clipboard_copy`), `shared_url` | Navigation Share button, Download Section Share button, Footer Share button |
| **Audio Play / Pause** | `audio_play` / `audio_pause` | `track_title`, `source` | Hero player play/pause button, Showcase player play/pause button |
| **Sound Mood / Profile** | `sound_profile_change` | `mood` | OptionWheel sound profile selection |
| **FAQ Toggled** | `faq_toggle` | `question`, `state` | FAQ accordion item expanded/collapsed |
| **Lyrics Viewed** | `lyrics_view` | `track_title` | Showcase interactive player lyrics button |

---

## 3. Querying via Google Analytics MCP (`analytics-mcp`)

Since the Google Analytics MCP server is connected in your workspace, you can directly ask Antigravity or use MCP tools to inspect analytics data:

- **Real-time visitors**: `run_realtime_report`
- **Total downloads & conversion metrics**: `run_report` or `run_conversions_report` filtering by `eventName = "download_apk"`
- **Outbound links**: `run_report` filtering by `eventName = "github_visit"` or `eventName = "portfolio_visit"`
- **Sharing & Skips**: `run_report` filtering by `eventName = "share"` or `eventName = "track_skipped"`

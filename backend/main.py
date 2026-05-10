from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
from typing import List, Dict, Any, Optional
import yt_dlp
import time
import asyncio
import re
import httpx
from difflib import SequenceMatcher

app = FastAPI(title="Aura Music Backend")

# In-memory cache for stream URLs and lyrics
# key: video_id, value: {"url": str, "expiry": float}
stream_cache = {}
lyrics_cache = {}
CACHE_TTL = 1800  # 30 minutes

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YTMusic (unauthenticated mode)
yt = YTMusic()

def normalize_metadata(text: str):
    """
    Cleans up titles and artist names for better matching.
    Removes (Official Video), [Lyric Video], etc.
    """
    if not text:
        return ""
    # Remove common YouTube suffixes
    text = re.sub(r'\(.*?\)|\[.*?\]', '', text)
    # Remove "Official Video", "Lyric Video", etc.
    text = re.sub(r'(?i)official|video|audio|lyric|hd|4k|remastered', '', text)
    return text.strip()

def normalize_for_matching(text: str) -> str:
    """
    Deep normalization for fuzzy matching.
    Removes all special characters, converts to lowercase, removes extra spaces.
    """
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove featured artists notation (feat. X, ft. X, etc.)
    text = re.sub(r'\s*(?:feat\.?|ft\.?|featuring)\s+[^,)]*', '', text, flags=re.IGNORECASE)
    # Remove remix/version suffixes
    text = re.sub(r'\s*(?:remix|mix|version|edit|extended|single|radio edit|acoustic|live|cover|cover version|instrumental|radio cut|album version)\s*', '', text, flags=re.IGNORECASE)
    # Keep only alphanumeric and spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def calculate_similarity(str1: str, str2: str) -> float:
    """
    Calculate similarity score between two strings (0-1).
    Uses SequenceMatcher for efficient string comparison.
    """
    if not str1 or not str2:
        return 0.0
    matcher = SequenceMatcher(None, str1, str2)
    return matcher.ratio()

def calculate_match_confidence(title: str, artist: str, lrc_title: str, lrc_artist: str, duration: Optional[int] = None, lrc_duration: Optional[int] = None) -> float:
    """
    Calculate confidence score for a potential lyrics match (0-1).
    Based on title and artist similarity, with optional duration validation.
    """
    # Normalize all inputs
    norm_title = normalize_for_matching(title)
    norm_artist = normalize_for_matching(artist)
    norm_lrc_title = normalize_for_matching(lrc_title)
    norm_lrc_artist = normalize_for_matching(lrc_artist)
    
    # Calculate similarities
    title_sim = calculate_similarity(norm_title, norm_lrc_title)
    artist_sim = calculate_similarity(norm_artist, norm_lrc_artist)
    
    # Weighted score: artist match is slightly more important
    base_score = (title_sim * 0.45) + (artist_sim * 0.55)
    
    # Bonus for duration match
    confidence = base_score
    if duration and lrc_duration:
        duration_diff = abs(duration - lrc_duration)
        # If duration is within 5 seconds, add small bonus
        if duration_diff <= 5:
            confidence = min(1.0, confidence + 0.05)
        # If duration differs significantly, penalize
        elif duration_diff > 15:
            confidence = max(0.0, confidence - 0.15)
    
    return confidence

def get_stream_url(video_id: str):
    """
    Extracts the best audio-only stream URL using yt-dlp.
    Uses browser cookies to bypass YouTube's bot detection.
    Includes fallback logic for cookie database locking issues.
    """
    # Base options
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'force_generic_extractor': False,
        'skip_download': True,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'log_tostderr': False,
        'socket_timeout': 10,
        'geo_bypass': True,
    }
    
    # Try multiple extraction strategies
    # 1. Chrome cookies
    # 2. Edge cookies (fallback Chromium)
    # 3. No cookies (last resort)
    strategies = [
        {'cookiesfrombrowser': ('chrome',)},
        {'cookiesfrombrowser': ('edge',)},
        {} # No cookies
    ]
    
    for strategy in strategies:
        current_opts = {**ydl_opts, **strategy}
        strategy_name = strategy.get('cookiesfrombrowser', ('none',))[0]
        
        try:
            with yt_dlp.YoutubeDL(current_opts) as ydl:
                url = f"https://www.youtube.com/watch?v={video_id}"
                info = ydl.extract_info(url, download=False)
                if info and info.get('url'):
                    print(f"[Backend] Successfully resolved {video_id} using {strategy_name} strategy.")
                    return info.get('url'), info.get('duration')
        except Exception as e:
            error_msg = str(e)
            print(f"[Backend] Strategy {strategy_name} failed for {video_id}: {error_msg}")
            
            # If bot detection is explicitly triggered, we must try next strategy
            if "confirm you're not a bot" in error_msg or "Sign in" in error_msg:
                continue
            
            # If it's a cookie access error, continue to next strategy immediately
            if "cookie" in error_msg.lower() or "permission" in error_msg.lower():
                continue
                
            # For other errors, maybe retry once more after a short sleep if it's the first strategy
            if strategy_name == 'chrome':
                time.sleep(0.5)
                continue

    return None, None

@app.get("/")
def root():
    """
    Root endpoint to verify the backend is running.
    """
    return {"message": "Aura backend running", "engine": "ytmusicapi + yt-dlp"}

@app.get("/search", response_model=List[Dict[str, Any]])
def search_songs(q: str = Query(..., description="The search query for songs")):
    """
    Search for songs using ytmusicapi and return a simplified JSON format.
    """
    # Search specifically for songs with a higher limit for better queue context
    search_results = yt.search(q, filter="songs", limit=25)
    
    results = []
    for item in search_results:
        # Safely extract fields using .get()
        title = item.get("title", "Unknown Title")
        
        # Artists can be a list of dicts
        artists = item.get("artists", [])
        artist_name = artists[0].get("name", "Unknown Artist") if artists else "Unknown Artist"
        
        video_id = item.get("videoId", "")
        if not video_id:
            continue
            
        # Thumbnails are usually a list of dicts with url, width, height
        thumbnails = item.get("thumbnails", [])
        thumbnail_url = ""
        if thumbnails:
            # Pick the largest one
            thumbnail_url = thumbnails[-1].get("url", "")
            # Upgrade quality if it's a standard YTMusic resize URL
            if "=w" in thumbnail_url and "-h" in thumbnail_url:
                thumbnail_url = re.sub(r'=w\d+-h\d+', '=w1200-h1200', thumbnail_url)
            elif "s90" in thumbnail_url:
                thumbnail_url = thumbnail_url.replace("s90", "s1200")
        
        results.append({
            "id": video_id, 
            "title": title,
            "artist": artist_name,
            "videoId": video_id,
            "thumbnail": thumbnail_url,
            "duration": item.get("duration")
        })
        
    return results

@app.get("/resolve/{video_id}")
async def resolve_stream(video_id: str):
    """
    Resolves a playable audio stream URL for a given videoId.
    Uses in-memory cache to reduce extraction overhead.
    """
    # Check cache
    now = time.time()
    if video_id in stream_cache:
        cached = stream_cache[video_id]
        if now < cached['expiry']:
            return {"streamUrl": cached['url'], "cached": True}

    # Extract new URL (run in thread pool to avoid blocking async event loop)
    loop = asyncio.get_event_loop()
    url, duration = await loop.run_in_executor(None, get_stream_url, video_id)
    
    if not url:
        raise HTTPException(status_code=404, detail="Could not resolve stream URL")
        
    # Store in cache
    stream_cache[video_id] = {
        "url": url,
        "expiry": now + CACHE_TTL
    }
    
    return {
        "streamUrl": url,
        "expiresIn": CACHE_TTL,
        "cached": False,
        "duration": duration
    }

def parse_synced_lyrics(synced_lrc: str) -> List[Dict[str, Any]]:
    """
    Parse LRC format synchronized lyrics.
    Format: [mm:ss.xx] Lyric text
    """
    parsed = []
    lines = synced_lrc.split('\n')
    for line in lines:
        # Match [mm:ss.xx] or [mm:ss.x] Text
        match = re.match(r'\[(\d+):(\d+(?:\.\d+)?)\](.*)', line.strip())
        if match:
            minutes, seconds, text = match.groups()
            try:
                total_ms = int((int(minutes) * 60 + float(seconds)) * 1000)
                parsed.append({
                    "time": total_ms,
                    "text": text.strip()
                })
            except (ValueError, TypeError):
                continue
    # Sort by time
    parsed.sort(key=lambda x: x["time"])
    return parsed

def parse_plain_lyrics(plain_text: str) -> List[Dict[str, Any]]:
    """
    Parse plain (unsynced) lyrics.
    """
    parsed = []
    lines = plain_text.split('\n')
    for line in lines:
        text = line.strip()
        if text:
            parsed.append({
                "time": 0,
                "text": text
            })
    return parsed

@app.get("/lyrics/search")
async def search_lyrics(title: str = Query(...), artist: str = Query(...), duration: Optional[int] = Query(None)):
    """
    Search for lyrics from LRCLIB with robust matching.
    Returns top candidate with confidence score.
    """
    clean_title = normalize_metadata(title)
    clean_artist = normalize_metadata(artist)
    
    print(f"[Backend] Searching lyrics: {clean_title} - {clean_artist} (duration: {duration}s)")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            params = {
                "track_name": clean_title,
                "artist_name": clean_artist,
            }
            if duration:
                params["duration"] = duration

            response = await client.get("https://lrclib.net/api/search", params=params)
            
            if response.status_code == 200:
                results = response.json()
                
                if results:
                    # Score all results and pick the best one
                    scored_results = []
                    for result in results:
                        confidence = calculate_match_confidence(
                            title,
                            artist,
                            result.get("trackName", ""),
                            result.get("artistName", ""),
                            duration,
                            result.get("duration")
                        )
                        scored_results.append((result, confidence))
                    
                    # Sort by confidence descending
                    scored_results.sort(key=lambda x: x[1], reverse=True)
                    best_result, confidence = scored_results[0]
                    
                    # Only accept if confidence is reasonable (>0.5)
                    if confidence < 0.5:
                        print(f"[Backend] Low confidence match: {confidence:.2f}. Skipping.")
                        raise HTTPException(status_code=404, detail="No reliable lyrics match found")
                    
                    # Parse lyrics
                    parsed_lyrics = []
                    is_synced = False
                    
                    if best_result.get("syncedLyrics"):
                        is_synced = True
                        parsed_lyrics = parse_synced_lyrics(best_result["syncedLyrics"])
                    elif best_result.get("plainLyrics"):
                        parsed_lyrics = parse_plain_lyrics(best_result["plainLyrics"])
                    
                    response_data = {
                        "trackId": f"{clean_artist}|{clean_title}",  # Normalized cache key
                        "title": best_result.get("trackName"),
                        "artist": best_result.get("artistName"),
                        "synced": is_synced,
                        "confidence": round(confidence, 3),
                        "lyrics": parsed_lyrics,
                        "source": "LRCLIB",
                        "lrcId": best_result.get("id")
                    }
                    
                    print(f"[Backend] Found lyrics with confidence: {confidence:.2f}")
                    return response_data
                else:
                    print(f"[Backend] No results from LRCLIB for: {clean_title} - {clean_artist}")
                    raise HTTPException(status_code=404, detail="No lyrics found")
                    
        except HTTPException:
            raise
        except Exception as e:
            print(f"[Backend] Lyrics search error: {e}")
            raise HTTPException(status_code=500, detail=f"Lyrics search failed: {str(e)}")

@app.get("/lyrics/{video_id}")
async def get_lyrics(video_id: str, title: str = Query(...), artist: str = Query(...), duration: Optional[int] = Query(None)):
    """
    Get cached or fetch lyrics for a specific video/track.
    Uses normalized cache key for better hit rate.
    """
    # Create normalized cache key
    norm_artist = normalize_for_matching(artist)
    norm_title = normalize_for_matching(title)
    cache_key = f"{norm_artist}|{norm_title}"
    
    # Check cache
    if cache_key in lyrics_cache:
        cached = lyrics_cache[cache_key]
        if time.time() < cached['expiry']:
            print(f"[Backend] Lyrics cache hit for: {artist} - {title}")
            # Update the response with the original video_id
            response = cached['data'].copy()
            response['trackId'] = video_id
            return response

    print(f"[Backend] Fetching lyrics for: {title} - {artist}")
    
    # Delegate to search endpoint
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await search_lyrics(title=title, artist=artist, duration=duration)
            
            # Cache the result with longer TTL
            lyrics_cache[cache_key] = {
                "data": response,
                "expiry": time.time() + (CACHE_TTL * 8)  # 4 hours cache for lyrics
            }
            
            # Update trackId to match requested video_id
            response['trackId'] = video_id
            return response
            
        except HTTPException as e:
            # Return 404 with meaningful message
            raise e
        except Exception as e:
            print(f"[Backend] Lyrics error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch lyrics: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

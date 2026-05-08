from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from ytmusicapi import YTMusic
from typing import List, Dict, Any

app = FastAPI(title="Aura Music Backend")

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

@app.get("/")
def root():
    """
    Root endpoint to verify the backend is running.
    """
    return {"message": "Aura backend running"}

@app.get("/search", response_model=List[Dict[str, Any]])
def search_songs(q: str = Query(..., description="The search query for songs")):
    """
    Search for songs using ytmusicapi and return a simplified JSON format.
    """
    # Search specifically for songs
    search_results = yt.search(q, filter="songs", limit=10)
    
    results = []
    for item in search_results:
        # Safely extract fields using .get()
        title = item.get("title", "Unknown Title")
        
        # Artists can be a list of dicts
        artists = item.get("artists", [])
        artist_name = artists[0].get("name", "Unknown Artist") if artists else "Unknown Artist"
        
        video_id = item.get("videoId", "")
        
        # Thumbnails are usually a list of dicts with url, width, height
        thumbnails = item.get("thumbnails", [])
        thumbnail_url = thumbnails[-1].get("url", "") if thumbnails else ""
        
        results.append({
            "title": title,
            "artist": artist_name,
            "videoId": video_id,
            "thumbnail": thumbnail_url
        })
        
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

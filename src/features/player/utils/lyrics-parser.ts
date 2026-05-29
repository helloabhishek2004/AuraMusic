export interface LyricWord {
  text: string;
  startTime: number; // ms
  endTime: number; // ms
}

export interface LyricLine {
  time: number; // ms
  text: string;
  words: LyricWord[];
  isWordLevel: boolean;
}

export interface ParsedLyrics {
  synced: boolean;
  isWordLevel: boolean;
  lyrics: LyricLine[];
}

/**
 * Parses word-level timestamps in the format: <00:10.50> word
 */
function parseELRCLine(lineText: string, lineStartTime: number): LyricWord[] {
  const tagRegex = /<(\d+):(\d+(?:\.\d+)?)>/g;
  const words: LyricWord[] = [];
  const matches: { time: number; index: number; length: number }[] = [];
  
  let match;
  while ((match = tagRegex.exec(lineText)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseFloat(match[2]);
    const totalMs = Math.round((minutes * 60 + seconds) * 1000);
    matches.push({
      time: totalMs,
      index: match.index,
      length: match[0].length,
    });
  }
  
  if (matches.length === 0) {
    return [];
  }
  
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index + matches[i].length;
    const endIdx = (i + 1 < matches.length) ? matches[i + 1].index : lineText.length;
    const wordText = lineText.substring(startIdx, endIdx).trim();
    
    if (wordText) {
      // Split in case multiple words are grouped under one tag
      const subWords = wordText.split(/\s+/).filter(Boolean);
      const startTime = matches[i].time;
      const endTime = (i + 1 < matches.length) ? matches[i + 1].time : startTime + 800; // default 800ms for last word
      
      if (subWords.length > 1) {
        const step = (endTime - startTime) / subWords.length;
        subWords.forEach((sw, swi) => {
          words.push({
            text: sw,
            startTime: Math.round(startTime + swi * step),
            endTime: Math.round(startTime + (swi + 1) * step),
          });
        });
      } else if (subWords.length === 1) {
        words.push({
          text: subWords[0],
          startTime,
          endTime,
        });
      }
    }
  }
  
  return words;
}

/**
 * Clean ELRC tags out of raw text for clean display
 */
export function cleanELRCTags(text: string): string {
  return text.replace(/<(\d+):(\d+(?:\.\d+)?)>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Unified parser for lyrics data returned from the backend.
 * Normalizes timestamps and resolves word-by-word precomputations.
 */
export function parseLyricsData(rawResponse: any): ParsedLyrics {
  if (!rawResponse || !rawResponse.lyrics || !Array.isArray(rawResponse.lyrics)) {
    return { synced: false, isWordLevel: false, lyrics: [] };
  }

  const rawLines = rawResponse.lyrics;
  const isSynced = rawResponse.synced === true;
  
  if (!isSynced) {
    // Plain lyrics fallback: Map each line to time 0 with no word timings
    const parsedLines: LyricLine[] = rawLines.map((line: any) => ({
      time: 0,
      text: (line.text || '').trim(),
      words: [],
      isWordLevel: false
    }));
    return { synced: false, isWordLevel: false, lyrics: parsedLines };
  }

  const parsedLines: LyricLine[] = [];
  let isWordLevel = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lineTime = typeof line.time === 'number' ? line.time : 0;
    const lineText = (line.text || '');
    
    // 1. Try parsing Enhanced ELRC tags first
    let words = parseELRCLine(lineText, lineTime);
    let isLineWordLevel = words.length > 0;
    
    // Clean text by stripping tags
    const cleanText = isLineWordLevel ? cleanELRCTags(lineText) : lineText.trim();
    
    if (isLineWordLevel) {
      isWordLevel = true;
    } else {
      // 2. Standard LRC fallback: distribute word timings dynamically based on next line's start
      const nextLineTime = (i + 1 < rawLines.length) 
        ? (typeof rawLines[i + 1].time === 'number' ? rawLines[i + 1].time : lineTime + 4000)
        : lineTime + 4000;
        
      const rawWords = cleanText.split(/\s+/).filter(Boolean);
      if (rawWords.length > 0) {
        const lineDuration = Math.max(100, nextLineTime - lineTime);
        const maxWordsDuration = Math.min(lineDuration, rawWords.length * 350); // cap at 350ms per word
        const step = maxWordsDuration / rawWords.length;
        
        words = rawWords.map((word: string, wIdx: number) => ({
          text: word,
          startTime: Math.round(lineTime + wIdx * step),
          endTime: Math.round(lineTime + (wIdx + 1) * step),
        }));
      }
    }

    parsedLines.push({
      time: lineTime,
      text: cleanText,
      words,
      isWordLevel: isLineWordLevel
    });
  }

  return {
    synced: true,
    isWordLevel,
    lyrics: parsedLines
  };
}

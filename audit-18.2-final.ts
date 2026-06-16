import { generateDailyMixes } from './src/features/recommendations/services/recommendation-engine';

const history = [
  { id: 'h1', title: 'Song 1', artist: 'The Weeknd', art: '', positionMs: 120000 },
  { id: 'h2', title: 'Song 2', artist: 'The Weeknd', art: '', positionMs: 120000 },
  { id: 'h3', title: 'Song 3', artist: 'Daft Punk', art: '', positionMs: 120000 }
];

const affinities = { 'The Weeknd': { score: 10, playCount: 2, skipCount: 0, completionCount: 2 }, 'Daft Punk': { score: 5, playCount: 1, skipCount: 0, completionCount: 1 } };

const discovery = [
  { type: 'track', id: 'd1', title: 'Discovery 1', artistName: 'Kavinsky', image: '' },
  { type: 'track', id: 'd2', title: 'Discovery 2', artistName: 'Justice', image: '' }
];

const mixes = generateDailyMixes(affinities as any, history as any, {}, discovery as any);

console.log(JSON.stringify(mixes[0], null, 2));

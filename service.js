import { Platform } from 'react-native';

let TrackPlayer;
let Event = {};

try {
    if (Platform.OS !== 'web') {
        const TP = require('react-native-track-player');
        TrackPlayer = TP.default;
        Event = TP.Event || {};
    }
} catch (e) {}

export const PlaybackService = async function() {
    if (!TrackPlayer || !Event) return;
    TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
    TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
    TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
    TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
    TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
    TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
    TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
        if (event.permanent) {
            await TrackPlayer.stop();
            return;
        }

        if (event.paused) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    });
};

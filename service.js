import TrackPlayer, { Event } from "@rntp/player";
import { Platform } from "react-native";

/**
 * V5 Migration: Background task service for remote playback control.
 * This service registers event listeners that persist when the app is backgrounded.
 */
export const PlaybackService = async function () {
  if (Platform.OS === "web") return;

  console.log("[Player] Registering background playback listeners...");

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log("[Service] Remote play");
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log("[Service] Remote pause");
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log("[Service] Remote next");
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log("[Service] Remote previous");
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log("[Service] Remote stop");
    TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log("[Service] Remote seek to", event.position);
    TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener("remote-duck", async (event) => {
    console.log("[Service] Remote duck", event);
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

  console.log("[Player] Background playback listeners registered.");
};

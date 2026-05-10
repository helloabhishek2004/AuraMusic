import TrackPlayer from "@rntp/player";
import { Platform } from "react-native";
import { PlaybackController } from "./src/features/player/services/playback.controller";

/**
 * V5 Migration: Background task service for remote playback control.
 * In v5, this is registered via registerBackgroundEventHandler.
 */
let isServiceInitialized = false;

export const PlaybackService = async function () {
  if (Platform.OS === "web") return;
  if (isServiceInitialized) {
    console.log("[Service] Background playback listeners already registered.");
    return;
  }

  console.log("[Service] Registering background playback listeners...");

  // Initialize the controller which sets up all listeners (Remote + Playback State)
  // This ensures a single authoritative source for event handling.
  PlaybackController.initialize();

  isServiceInitialized = true;
  console.log("[Service] Background playback listeners registered.");
};


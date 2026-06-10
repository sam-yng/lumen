import { describe, expect, it } from "vitest";
import {
  createInitialLiveSessionState,
  liveSessionReducer,
} from "@/components/transcripts/live-session-state";

describe("liveSessionReducer", () => {
  it("clears prior errors and warnings when starting", () => {
    const state = {
      ...createInitialLiveSessionState(),
      phase: "error" as const,
      error: "Microphone blocked.",
      asrWarning: "Transcription stopped.",
    };

    expect(liveSessionReducer(state, { type: "beginStart" })).toMatchObject({
      phase: "starting",
      error: null,
      asrWarning: null,
    });
  });

  it("resets transient transcript state when recording starts", () => {
    const state = {
      ...createInitialLiveSessionState(),
      phase: "starting" as const,
      elapsed: 42,
      finals: [{ endMs: 1000, speaker: null, startMs: 0, text: "old text" }],
      interim: "old interim",
    };

    expect(
      liveSessionReducer(state, { type: "recordingStarted" }),
    ).toMatchObject({
      phase: "recording",
      elapsed: 0,
      finals: [],
      interim: null,
    });
  });

  it("appends final segments and clears interim text", () => {
    const previous = { endMs: 500, speaker: null, startMs: 0, text: "first" };
    const next = { endMs: 1000, speaker: null, startMs: 500, text: "second" };
    const state = {
      ...createInitialLiveSessionState(),
      phase: "recording" as const,
      finals: [previous],
      interim: "partial",
    };

    expect(
      liveSessionReducer(state, { segment: next, type: "finalSegment" }),
    ).toMatchObject({
      finals: [previous, next],
      interim: null,
    });
  });
});

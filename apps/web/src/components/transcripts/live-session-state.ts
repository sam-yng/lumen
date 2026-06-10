import type { AsrStatus } from "@/lib/transcription/asr-protocol";
import type { StreamingSegment } from "@/lib/transcription/streaming-provider";

export type Phase = "idle" | "starting" | "recording" | "saving" | "error";

export type LiveSessionState = {
  phase: Phase;
  name: string;
  error: string | null;
  asrWarning: string | null;
  asrStatus: AsrStatus | null;
  elapsed: number;
  finals: StreamingSegment[];
  interim: string | null;
};

export type LiveSessionAction =
  | { type: "asrStatus"; status: AsrStatus | null }
  | { type: "asrWarning"; warning: string | null }
  | { type: "beginStart" }
  | { type: "elapsed"; seconds: number }
  | { type: "fail"; error: string }
  | { type: "finalSegment"; segment: StreamingSegment }
  | { type: "interimSegment"; text: string | null }
  | { type: "name"; name: string }
  | { type: "recordingStarted" }
  | { type: "saving" };

export function createInitialLiveSessionState(): LiveSessionState {
  return {
    phase: "idle",
    name: "",
    error: null,
    asrWarning: null,
    asrStatus: null,
    elapsed: 0,
    finals: [],
    interim: null,
  };
}

export function liveSessionReducer(
  state: LiveSessionState,
  action: LiveSessionAction,
): LiveSessionState {
  switch (action.type) {
    case "asrStatus":
      return { ...state, asrStatus: action.status };
    case "asrWarning":
      return { ...state, asrWarning: action.warning };
    case "beginStart":
      return { ...state, asrWarning: null, error: null, phase: "starting" };
    case "elapsed":
      return { ...state, elapsed: action.seconds };
    case "fail":
      return { ...state, error: action.error, phase: "error" };
    case "finalSegment":
      return {
        ...state,
        finals: [...state.finals, action.segment],
        interim: null,
      };
    case "interimSegment":
      return { ...state, interim: action.text };
    case "name":
      return { ...state, name: action.name };
    case "recordingStarted":
      return {
        ...state,
        elapsed: 0,
        finals: [],
        interim: null,
        phase: "recording",
      };
    case "saving":
      return { ...state, phase: "saving" };
  }
}

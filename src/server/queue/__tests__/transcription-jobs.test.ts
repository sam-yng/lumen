import { describe, expect, it, vi } from "vitest";
import {
  enqueueTranscriptionJob,
  TRANSCRIPTION_QUEUE_NAME,
  type TranscriptionJobPayload,
  type TranscriptionJobQueue,
} from "@/server/queue/transcription-jobs";

const validPayload: TranscriptionJobPayload = {
  userId: "018f4ed6-30f2-7838-8b36-2464c4b59e2f",
  recordingId: "018f4ed7-47c4-7583-8207-1e5ce4d0a2a7",
  fileId: "018f4ed8-0d34-73bd-8b71-307768d57b02",
  storageKey: "recordings/user/lecture.m4a",
};

describe("transcription jobs", () => {
  it("sends a valid payload to the transcription queue", async () => {
    const send = vi
      .fn<TranscriptionJobQueue["send"]>()
      .mockResolvedValue("job-1");
    const boss = { send };

    await expect(enqueueTranscriptionJob(boss, validPayload)).resolves.toBe(
      "job-1",
    );

    expect(send).toHaveBeenCalledExactlyOnceWith(
      TRANSCRIPTION_QUEUE_NAME,
      validPayload,
      {
        expireInSeconds: 60 * 60,
        retryBackoff: true,
        retryDelay: 30,
        retryLimit: 3,
      },
    );
  });

  it("rejects an invalid payload before sending", async () => {
    const send = vi.fn<TranscriptionJobQueue["send"]>();
    const boss = { send };

    await expect(
      enqueueTranscriptionJob(boss, {
        ...validPayload,
        fileId: "not-a-uuid",
      }),
    ).rejects.toThrow();

    expect(send).not.toHaveBeenCalled();
  });

  it("treats a null send result as an enqueue error", async () => {
    const send = vi.fn<TranscriptionJobQueue["send"]>().mockResolvedValue(null);
    const boss = { send };

    await expect(enqueueTranscriptionJob(boss, validPayload)).rejects.toThrow(
      "Failed to enqueue transcription job.",
    );
  });
});

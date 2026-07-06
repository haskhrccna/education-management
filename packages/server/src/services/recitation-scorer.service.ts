import { prisma } from '../prisma/client';

export interface RecitationScoreResult {
  /** 0-100, or null when no engine is configured. */
  score: number | null;
  status: 'SCORED' | 'UNAVAILABLE';
  feedback: string[];
}

export interface RecitationScorer {
  score(recordingId: string, audioUrl: string): Promise<RecitationScoreResult>;
}

/**
 * No ASR/tajweed engine is wired in yet — the vendor choice (cloud ASR +
 * custom rules vs. a specialized recitation API vs. self-hosted) is
 * deliberately deferred pending a cost/privacy review for children's voice
 * data. This stub keeps the rest of the pipeline (job trigger, DB columns,
 * teacher UI) fully built: swapping in a real scorer later means only
 * changing `getRecitationScorer`, nothing that calls it.
 */
export class StubRecitationScorer implements RecitationScorer {
  async score(): Promise<RecitationScoreResult> {
    return { score: null, status: 'UNAVAILABLE', feedback: ['Automated scoring is not yet configured'] };
  }
}

export function getRecitationScorer(): RecitationScorer {
  return new StubRecitationScorer();
}

/** Scores one recording and persists the result. Best-effort — callers must never let this break an upload. */
export const scoreRecording = async (recordingId: string): Promise<void> => {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: { id: true, url: true },
  });
  if (!recording) return;

  const result = await getRecitationScorer().score(recording.id, recording.url);

  await prisma.recording.update({
    where: { id: recordingId },
    data: { accuracyScore: result.score, scoreStatus: result.status },
  });
};

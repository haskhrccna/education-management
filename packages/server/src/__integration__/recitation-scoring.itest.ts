import { Role } from '@prisma/client';
import { prisma } from '../prisma/client';
import { createUser } from './factory';
import { truncateAll, disconnect } from './db';
import { scoreRecording } from '../services/recitation-scorer.service';

beforeEach(truncateAll);
afterAll(disconnect);

// uploadRecording's dual-path trigger (queue when Redis is reachable, sync
// fallback otherwise) is exercised at the unit level in
// recording.service.test.ts, where the queue is mocked deterministically —
// here we'd otherwise get a different outcome depending on whether this
// machine happens to have a local Redis running.
describe('scoreRecording', () => {
  it('marks a recording UNAVAILABLE with a null score (no ASR engine configured yet)', async () => {
    const student = await createUser({ role: Role.STUDENT });
    const recording = await prisma.recording.create({
      data: {
        studentId: student.id,
        url: '/uploads/test.m4a',
        fileName: 'test.m4a',
        fileSizeBytes: 1024,
        contentType: 'audio/m4a',
      },
    });
    expect(recording.scoreStatus).toBe('PENDING');
    expect(recording.accuracyScore).toBeNull();

    await scoreRecording(recording.id);

    const updated = await prisma.recording.findUnique({ where: { id: recording.id } });
    expect(updated!.scoreStatus).toBe('UNAVAILABLE');
    expect(updated!.accuracyScore).toBeNull();
  });

  it('no-ops silently for a recording id that does not exist', async () => {
    await expect(scoreRecording('00000000-0000-4000-8000-000000000000')).resolves.toBeUndefined();
  });
});

import { shouldNudge } from '../streak-nudge.service';

// Local-time fixtures so the window logic is deterministic in any TZ.
const at = (h: number) => new Date(2026, 6, 19, h, 0, 0);
const yesterday = new Date(2026, 6, 18);
const today = new Date(2026, 6, 19);

describe('shouldNudge (AC7.1 window logic)', () => {
  it('nudges in the evening when no activity today and not yet nudged', () => {
    expect(shouldNudge({ now: at(20), lastActiveDate: yesterday, alreadyNudgedToday: false })).toBe(true);
  });

  it('never before the evening window', () => {
    expect(shouldNudge({ now: at(12), lastActiveDate: yesterday, alreadyNudgedToday: false })).toBe(false);
  });

  it('never when already active today', () => {
    expect(shouldNudge({ now: at(21), lastActiveDate: today, alreadyNudgedToday: false })).toBe(false);
  });

  it('never twice a day', () => {
    expect(shouldNudge({ now: at(22), lastActiveDate: yesterday, alreadyNudgedToday: true })).toBe(false);
  });
});

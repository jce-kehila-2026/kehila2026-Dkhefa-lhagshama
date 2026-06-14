import {
  scoreVolunteers,
  type MatchRequest,
  type MatchVolunteer,
  WEIGHTS,
} from './matchVolunteers';

const baseReq: MatchRequest = {
  category: 'education',
  preferredLanguage: 'am',
  deadline: null,
};

function vol(p: Partial<MatchVolunteer> & { uid: string }): MatchVolunteer {
  return {
    uid: p.uid,
    name: p.name ?? p.uid,
    languages: p.languages ?? [],
    areas: p.areas ?? [],
    approvedCategories: p.approvedCategories ?? [],
    workStatus: p.workStatus ?? 'free',
    openLoad: p.openLoad ?? 0,
    availabilityWindows: p.availabilityWindows ?? [],
  };
}

describe('scoreVolunteers', () => {
  it('returns an empty array for zero volunteers', () => {
    expect(scoreVolunteers(baseReq, [])).toEqual([]);
  });

  it('ranks an approved-category volunteer above an unrelated one', () => {
    const ranked = scoreVolunteers(baseReq, [
      vol({ uid: 'b', approvedCategories: ['health'] }),
      vol({ uid: 'a', approvedCategories: ['education'] }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(['a', 'b']);
    expect(ranked[0].reasons).toContainEqual({ key: 'sameCategory' });
  });

  it('scores an exact category match higher than a fuzzy areas match', () => {
    const exact = scoreVolunteers(baseReq, [vol({ uid: 'x', approvedCategories: ['education'] })])[0];
    const fuzzy = scoreVolunteers(baseReq, [vol({ uid: 'y', areas: ['education'] })])[0];
    expect(exact.score).toBeGreaterThan(fuzzy.score);
    expect(fuzzy.reasons).toContainEqual({ key: 'relatedArea' });
  });

  it('adds the language reason and weight when the volunteer speaks the preferred language', () => {
    const speaks = scoreVolunteers(baseReq, [vol({ uid: 's', languages: ['he', 'am'] })])[0];
    const silent = scoreVolunteers(baseReq, [vol({ uid: 'q', languages: ['he'] })])[0];
    expect(speaks.score - silent.score).toBe(WEIGHTS.language);
    expect(speaks.reasons).toContainEqual({ key: 'speaksLanguage', lang: 'am' });
    expect(silent.reasons).not.toContainEqual({ key: 'speaksLanguage', lang: 'am' });
  });

  it('emits no language signal when the request has no preferredLanguage', () => {
    const r = scoreVolunteers({ ...baseReq, preferredLanguage: null }, [
      vol({ uid: 'a', languages: ['am'] }),
    ])[0];
    expect(r.reasons).not.toContainEqual({ key: 'speaksLanguage', lang: 'am' });
  });

  it('ranks a free volunteer above a working one above an unavailable one', () => {
    const ranked = scoreVolunteers(baseReq, [
      vol({ uid: 'u', workStatus: 'unavailable' }),
      vol({ uid: 'f', workStatus: 'free' }),
      vol({ uid: 'w', workStatus: 'working' }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(['f', 'w', 'u']);
    expect(ranked[0].reasons).toContainEqual({ key: 'currentlyFree' });
  });

  it('ranks a lower open-load volunteer above a busier one, all else equal', () => {
    const ranked = scoreVolunteers(baseReq, [
      vol({ uid: 'busy', openLoad: 5 }),
      vol({ uid: 'light', openLoad: 0 }),
    ]);
    expect(ranked.map((r) => r.uid)).toEqual(['light', 'busy']);
    expect(ranked[0].reasons).toContainEqual({ key: 'lowLoad', count: 0 });
  });

  it('breaks an exact score tie by name (stable, ascending)', () => {
    const ranked = scoreVolunteers(baseReq, [
      vol({ uid: '2', name: 'Zoe', approvedCategories: ['education'] }),
      vol({ uid: '1', name: 'Adam', approvedCategories: ['education'] }),
    ]);
    expect(ranked.map((r) => r.name)).toEqual(['Adam', 'Zoe']);
  });

  it('boosts a volunteer whose availability window precedes the deadline', () => {
    const req: MatchRequest = { ...baseReq, deadline: '2026-07-10T00:00:00.000Z' };
    const covered = scoreVolunteers(req, [
      vol({ uid: 'c', availabilityWindows: [{ day: 1, start: '09:00', end: '17:00' }] }),
    ])[0];
    const none = scoreVolunteers(req, [vol({ uid: 'n', availabilityWindows: [] })])[0];
    expect(covered.score).toBeGreaterThan(none.score);
    expect(covered.reasons).toContainEqual({ key: 'availableBeforeDeadline' });
  });

  it('does NOT boost when the only window is on a weekday that never recurs before the deadline', () => {
    // now = Sunday 2026-06-14 (UTC). deadline = Monday 2026-06-15. The volunteer's
    // sole window is Thursday (day=4), which does not fall in the Sun→Mon span.
    const now = Date.parse('2026-06-14T00:00:00.000Z'); // Sunday
    const req: MatchRequest = { ...baseReq, deadline: '2026-06-15T00:00:00.000Z' }; // Monday
    const thursdayOnly = scoreVolunteers(
      req,
      [vol({ uid: 't', availabilityWindows: [{ day: 4, start: '09:00', end: '17:00' }] })],
      now,
    )[0];
    expect(thursdayOnly.reasons).not.toContainEqual({ key: 'availableBeforeDeadline' });
  });

  it('boosts when a window weekday falls within the now→deadline span (day-aware)', () => {
    const now = Date.parse('2026-06-14T00:00:00.000Z'); // Sunday
    const req: MatchRequest = { ...baseReq, deadline: '2026-06-15T00:00:00.000Z' }; // Monday
    const mondayWindow = scoreVolunteers(
      req,
      [vol({ uid: 'm', availabilityWindows: [{ day: 1, start: '09:00', end: '17:00' }] })],
      now,
    )[0];
    expect(mondayWindow.reasons).toContainEqual({ key: 'availableBeforeDeadline' });
  });
});

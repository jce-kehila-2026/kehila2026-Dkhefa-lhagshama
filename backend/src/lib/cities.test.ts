/**
 * Unit tests for the locality table: the CKAN normalisation (the raw dataset
 * pads every field with spaces and ships Latin names in ALL CAPS) and the
 * resolvers that guarantee a stored name can never disagree with its code.
 */
import {
  titleCaseLatin,
  normalizeCityRecords,
  getCities,
  getCityByCode,
  findCityByName,
  resolveCityFields,
  resolveBilingualCity,
} from './cities';

describe('titleCaseLatin', () => {
  it('title-cases an ALL CAPS name', () => {
    expect(titleCaseLatin('JERUSALEM')).toBe('Jerusalem');
    expect(titleCaseLatin('RAMAT GAN')).toBe('Ramat Gan');
  });

  it('keeps an apostrophe inside a word', () => {
    expect(titleCaseLatin("BE'ER SHEVA")).toBe("Be'er Sheva");
  });

  it('capitalises after a hyphen separator', () => {
    expect(titleCaseLatin('TEL AVIV - YAFO')).toBe('Tel Aviv - Yafo');
  });
});

describe('normalizeCityRecords', () => {
  const raw = [
    { 'סמל_ישוב': '5000 ', 'שם_ישוב': 'תל אביב - יפו ', 'שם_ישוב_לועזי': 'TEL AVIV - YAFO ' },
    { 'סמל_ישוב': '4000 ', 'שם_ישוב': 'חיפה ', 'שם_ישוב_לועזי': 'HAIFA ' },
    // No Latin name — 4 real localities are like this.
    { 'סמל_ישוב': '1331 ', 'שם_ישוב': 'כמאנה ', 'שם_ישוב_לועזי': ' ' },
    // Unusable rows: no code / no Hebrew name.
    { 'סמל_ישוב': ' ', 'שם_ישוב': 'לא תקין ', 'שם_ישוב_לועזי': 'INVALID ' },
    { 'סמל_ישוב': '9999 ', 'שם_ישוב': ' ', 'שם_ישוב_לועזי': 'NONAME ' },
  ];

  it('trims the padded fields and title-cases the Latin name', () => {
    const cities = normalizeCityRecords(raw);
    const tlv = cities.find((c) => c.code === '5000');
    expect(tlv).toEqual({ code: '5000', nameHe: 'תל אביב - יפו', nameEn: 'Tel Aviv - Yafo' });
  });

  it('falls back to the Hebrew name when there is no Latin one', () => {
    const kamane = normalizeCityRecords(raw).find((c) => c.code === '1331');
    expect(kamane?.nameEn).toBe('כמאנה');
  });

  it('drops rows missing a code or a Hebrew name', () => {
    const codes = normalizeCityRecords(raw).map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(['5000', '4000', '1331']));
    expect(codes).not.toContain('9999');
    expect(codes).toHaveLength(3);
  });

  it('de-duplicates by code', () => {
    const dupes = [...raw, { 'סמל_ישוב': '5000', 'שם_ישוב': 'תל אביב', 'שם_ישוב_לועזי': 'TEL AVIV' }];
    expect(normalizeCityRecords(dupes).filter((c) => c.code === '5000')).toHaveLength(1);
  });

  it('sorts by Hebrew name', () => {
    const names = normalizeCityRecords(raw).map((c) => c.nameHe);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'he')));
  });
});

describe('committed snapshot', () => {
  it('ships the full locality table so the pickers work offline', () => {
    expect(getCities().length).toBeGreaterThan(1000);
  });

  it('resolves a known code', () => {
    expect(getCityByCode('5000')?.nameHe).toBe('תל אביב - יפו');
    expect(getCityByCode('  5000  ')?.code).toBe('5000');
    expect(getCityByCode('not-a-code')).toBeUndefined();
  });
});

describe('findCityByName', () => {
  it('matches an exact official name in either language', () => {
    expect(findCityByName('חיפה')?.code).toBe('4000');
    expect(findCityByName('Haifa')?.code).toBe('4000');
  });

  it('ignores punctuation and case differences', () => {
    expect(findCityByName('  בני-ברק ')?.code).toBe('6100');
    expect(findCityByName("be'er sheva")?.code).toBe('9000');
  });

  it('reconciles ktiv male against the table ktiv haser', () => {
    // People write "קריית גת"; the official table has "קרית גת".
    expect(findCityByName('קריית גת')?.code).toBe('2630');
  });

  it('matches the leading segment of a dashed official name', () => {
    // Stored as "תל אביב"; official name is "תל אביב - יפו".
    expect(findCityByName('תל אביב')?.code).toBe('5000');
    expect(findCityByName('Tel Aviv')?.code).toBe('5000');
  });

  it('returns undefined rather than guessing for a non-locality', () => {
    // A Jerusalem neighbourhood, not a locality in its own right.
    expect(findCityByName('כפר עקב')).toBeUndefined();
    expect(findCityByName('עיר שלא קיימת')).toBeUndefined();
    expect(findCityByName('')).toBeUndefined();
    expect(findCityByName(null)).toBeUndefined();
  });
});

describe('resolveCityFields', () => {
  it('derives the name from the code, ignoring a mismatched name in the body', () => {
    // This is the anti-spoof guarantee: the caller claimed Haifa with Tel Aviv's code.
    expect(resolveCityFields('5000', 'חיפה')).toEqual({ city: 'תל אביב - יפו', cityCode: '5000' });
  });

  it('falls back to the free-text name when the code is unknown or absent', () => {
    expect(resolveCityFields('', 'מקום כלשהו')).toEqual({ city: 'מקום כלשהו', cityCode: null });
    expect(resolveCityFields('nope', ' שם ישן ')).toEqual({ city: 'שם ישן', cityCode: null });
    expect(resolveCityFields(null, null)).toEqual({ city: '', cityCode: null });
  });
});

describe('resolveBilingualCity', () => {
  it('produces a genuinely bilingual pair from a code', () => {
    expect(resolveBilingualCity('4000', 'whatever')).toEqual({
      city: { he: 'חיפה', en: 'Haifa' },
      cityCode: '4000',
    });
  });

  it('duplicates the free-text name into both slots when there is no code', () => {
    expect(resolveBilingualCity('', 'עיר ישנה')).toEqual({
      city: { he: 'עיר ישנה', en: 'עיר ישנה' },
      cityCode: null,
    });
  });
});

/**
 * Unit tests for the Israeli ID check. The headline case is "000000000":
 * it satisfies the official checksum (sum 0 is divisible by 10) and was also
 * the form's placeholder, so it used to be accepted as a real identity number.
 */
import { isValidIsraeliId, completeIsraeliId } from './israeliId';

describe('isValidIsraeliId', () => {
  it('accepts a genuinely valid number', () => {
    expect(isValidIsraeliId('123456782')).toBe(true);
    expect(isValidIsraeliId('000000018')).toBe(true);
  });

  it('rejects all zeros even though the raw checksum passes', () => {
    expect(isValidIsraeliId('000000000')).toBe(false);
  });

  it('rejects every single-repeated-digit number', () => {
    for (let d = 0; d <= 9; d += 1) {
      expect(isValidIsraeliId(String(d).repeat(9))).toBe(false);
    }
  });

  it('rejects a wrong check digit', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('300000003')).toBe(false);
  });

  it('requires exactly nine digits and never zero-pads a short number', () => {
    // Padding would silently turn a typo into a different valid person's ID.
    expect(isValidIsraeliId('12345678')).toBe(false);
    expect(isValidIsraeliId('1234567820')).toBe(false);
  });

  it('tolerates separators but not letters', () => {
    expect(isValidIsraeliId('12345678-2')).toBe(true);
    expect(isValidIsraeliId(' 123456782 ')).toBe(true);
    // Must not pass by having its letters stripped out.
    expect(isValidIsraeliId('12345678a2')).toBe(false);
    expect(isValidIsraeliId('abcdefghi')).toBe(false);
  });

  it('rejects empty and nullish input', () => {
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('   ')).toBe(false);
    expect(isValidIsraeliId(null)).toBe(false);
    expect(isValidIsraeliId(undefined)).toBe(false);
  });
});

describe('completeIsraeliId', () => {
  it('produces a number the validator accepts', () => {
    for (let i = 0; i < 60; i += 1) {
      const id = completeIsraeliId(String(30000000 + i));
      expect(isValidIsraeliId(id)).toBe(true);
    }
  });

  it('never emits the degenerate all-zero number', () => {
    const id = completeIsraeliId('00000000');
    expect(id).not.toBe('000000000');
    expect(isValidIsraeliId(id)).toBe(true);
  });

  it('keeps the supplied prefix and only appends a check digit', () => {
    const id = completeIsraeliId('12345678');
    expect(id.slice(0, 8)).toBe('12345678');
    expect(id).toHaveLength(9);
  });
});

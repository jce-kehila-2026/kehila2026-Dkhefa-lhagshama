/**
 * Jest config for the Firestore + Storage rules test suite (#89).
 * Tests live under tests/rules/*.test.js and run in a Node environment
 * against the Firebase emulators.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/rules/**/*.test.js'],
  // Rules tests talk to the emulator over the network; give them headroom.
  testTimeout: 20000,
};

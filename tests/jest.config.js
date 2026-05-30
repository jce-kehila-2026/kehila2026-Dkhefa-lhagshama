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
  // Run suites serially. The firestore and storage suites both connect to the
  // shared emulator and clear it in afterEach; running them in parallel workers
  // lets one suite's clearFirestore() wipe the other's seeded data mid-test.
  // Each suite also uses a distinct projectId for extra isolation.
  maxWorkers: 1,
};

// The harness renders screens with fixtures passed in directly, so no screen
// under test reaches the database. Throwing here keeps that honest: if a screen
// ever does touch storage, the screenshot fails loudly instead of showing a
// silently empty state.
const unreachable = () => {
  throw new Error('expo-sqlite reached during screenshot rendering');
};
export const openDatabaseAsync = unreachable;
export const openDatabaseSync = unreachable;
export type SQLiteDatabase = never;

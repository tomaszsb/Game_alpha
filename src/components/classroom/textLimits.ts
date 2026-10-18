// The longest text a teacher can type into a classroom field. Mirrors
// server/textLimits.js, which refuses anything longer (v3.8.6); the
// maxLength here just stops the typing before the server has to say no.
// tests/server/textLimits.test.ts keeps the two in step.
export const TEXT_LIMITS = {
  long: 2000,  // a story, an Event/Action/Outcome line
  short: 200,  // a name, a title, a time or fee value
} as const;

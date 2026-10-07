// The headless game harness lives in src/headless/ now (the "Check my board" server job ships it, and
// the production image leaves tests/ out). This stub keeps every existing test import working.
export * from '../../src/headless/bootstrapServices';

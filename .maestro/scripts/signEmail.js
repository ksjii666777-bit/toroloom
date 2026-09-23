/**
 * Toroloom E2E helper — runScript: unique signup email.
 * Emits SIGNUP_EMAIL as a Maestro output variable (JSON to stdout).
 * Plain-dot emails only: the backend input sanitizer is strict about
 * local-part characters, so we stay conservative.
 */
const out = { SIGNUP_EMAIL: `e2e.maestro.${Date.now()}@toroloom-test.com` };
console.log(JSON.stringify(out));

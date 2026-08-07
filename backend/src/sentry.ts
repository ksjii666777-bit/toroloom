/**
 * ============================================================================
 * Toroloom Backend — Sentry Bootstrap
 * ============================================================================
 *
 * MUST be imported FIRST in server.ts (before `import express`).
 *
 * In CommonJS, module requires execute in import order, so `import './sentry'`
 * as the very first import runs Sentry.init() BEFORE `require('express')`
 * executes — which lets @sentry/node instrument express request handlers.
 * (Importing express before Sentry.init() produces:
 *  "[Sentry] express is not instrumented..." and drops request error traces.)
 *
 * ============================================================================
 */

import * as Sentry from '@sentry/node';
import { env } from './config/env';

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.isDev ? 0.1 : 0.5,
    integrations: [Sentry.expressIntegration()],
  });
}

export default Sentry;

'use strict';

// Test preload only. Keep a checked-out .env from silently restoring real
// providers or account integrations after the QA wrapper sanitized its env.
require('./qa-local-only');
require('node:assert/strict').equal(process.env.SC_REFERENCE_MOTION, 'true');
require('node:assert/strict').equal(process.env.SC_ISOLATED_POSTGRES_QA, 'true');
require('dotenv').config = () => ({ parsed: {} });

'use strict';
// Read-only UI fixture. No database, provider, billing, real account or uploads.
// This is layout/interaction evidence only, never animation-engine evidence.
const express = require('express'), path = require('node:path');
const app = express(), port = Number(process.argv[2] || 3391);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid local preview port');
app.get('/api/auth/me', (_req, res) => res.json({success: true, user: {id: 'home-ui-preview', displayName: 'Preview Account', email: 'preview@example.invalid', handle: '@preview', plan: 'free'}}));
app.get('/api/credits', (_req, res) => res.json({success: true, plan: 'free', planLabel: 'Free', left: 5, dailyLeft: 5, perDay: 5, bonusCredits: 0, maxHeight: 480, cost: {animate: 2, export: 1}}));
app.get('/api/reference-motion/status', (_req, res) => res.json({success: true, enabled: true, processingLocation: 'OWNER_PC', workerOnline: false, reconstruction: 'SUPPORTED_PLANAR_CARDS_OR_FLAT_VECTORS'}));
app.get('/api/*', (_req, res) => res.json({success: true, items: [], templates: [], designs: [], tutorials: [], notifications: [], unread: 0}));
app.use('/api', (_req, res) => res.status(405).json({success: false, error: 'Read-only UI preview: no uploads, generation or account writes.'}));
app.get('/', (_req, res) => res.sendFile(path.resolve(__dirname, '../public/index.html')));
app.use(express.static(path.resolve(__dirname, '../public'), {dotfiles: 'deny', extensions: ['html']}));
const server = app.listen(port, '127.0.0.1', () => console.log(`Read-only home UI preview: http://127.0.0.1:${port}`));
process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());

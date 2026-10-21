'use strict';
require('./helpers/reference-motion-local-only');
const timer = setInterval(() => console.log(JSON.stringify({qaMemory: true, rss: process.memoryUsage().rss})), 1000);
timer.unref();

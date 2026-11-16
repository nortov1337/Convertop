import { createApp } from './app.js';
import { config } from './config.js';
import { ensureDirs, cleanupTemp } from './storage.js';

ensureDirs();
cleanupTemp(config.tempTtlMs);
const interval = setInterval(() => cleanupTemp(config.tempTtlMs), config.tempTtlMs);
if (typeof interval.unref === 'function') interval.unref();

const app = createApp();
app.listen(config.port, () => {
  console.log(`Convertop: http://localhost:${config.port}`);
});

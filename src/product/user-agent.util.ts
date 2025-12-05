// src/common/utils/user-agent.util.ts
import * as UAParser from 'ua-parser-js';

export function parseUserAgent(ua: string) {
  const parser = new (UAParser as any)(ua || '');
  const r = parser.getResult();
  const device =
    r.device && (r.device.vendor || r.device.model)
      ? `${r.device.vendor || ''} ${r.device.model || ''}`.trim()
      : r.device.type || 'Desktop';
  return {
    device,
    browser: r.browser.name || 'Unknown',
    os: r.os.name || 'Unknown',
  };
}

const BOT_KEYWORDS = [
  'bot',
  'crawler',
  'spider',
  'bingpreview',
  'googlebot',
  'yandexbot',
  'bingbot',
  'baiduspider',
  'duckduckbot',
  'slurp',
  'facebookexternalhit',
];

export function isBot(ua?: string) {
  if (!ua) return false;
  const low = ua.toLowerCase();
  return BOT_KEYWORDS.some((k) => low.includes(k));
}

/**
 * Minimal structured logger with secret redaction.
 */

/** @type {string[]} */
let redactions = [];

/**
 * @param {string[]} secrets
 */
export function setRedactions(secrets) {
  redactions = (secrets || []).filter(Boolean).map(String);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function redact(text) {
  let out = String(text);
  for (const secret of redactions) {
    if (secret.length < 4) continue;
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [fields]
 */
function log(level, message, fields) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: redact(message),
    ...(fields ? JSON.parse(redact(JSON.stringify(fields))) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message, fields) => log('debug', message, fields),
  info: (message, fields) => log('info', message, fields),
  warn: (message, fields) => log('warn', message, fields),
  error: (message, fields) => log('error', message, fields),
};

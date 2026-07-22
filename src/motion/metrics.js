/**
 * Lightweight buffer sampling metrics (no native image decoder).
 * Suitable for synthetic tests and coarse JPEG byte-stream deltas.
 */

/**
 * @param {Buffer} buffer
 * @param {{ start: number, end: number }} roi
 * @param {number} stride
 * @returns {Uint8Array}
 */
export function sampleRegion(buffer, roi, stride) {
  const len = buffer.length;
  if (len === 0) return new Uint8Array(0);
  const start = Math.floor(len * roi.start);
  const end = Math.max(start + 1, Math.floor(len * roi.end));
  const step = Math.max(1, stride);
  const out = [];
  for (let i = start; i < end; i += step) {
    out.push(buffer[i]);
  }
  return Uint8Array.from(out);
}

/**
 * @param {Uint8Array} samples
 * @returns {number} mean 0..255
 */
export function meanBrightness(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i];
  return sum / samples.length;
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @param {number} pixelDiffThreshold
 * @returns {{ score: number, changed: number, compared: number }}
 */
export function deltaScore(a, b, pixelDiffThreshold) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return { score: 0, changed: 0, compared: 0 };
  let changed = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(a[i] - b[i]) >= pixelDiffThreshold) changed += 1;
  }
  return { score: changed / n, changed, compared: n };
}

/**
 * @param {Buffer} buffer
 * @param {object} cfg
 * @param {Uint8Array | null} previousSamples
 */
export function computeFrameMetrics(buffer, cfg, previousSamples) {
  const samples = sampleRegion(buffer, cfg.roi, cfg.sampleStride);
  const brightness = meanBrightness(samples);

  /** @type {Array<{ name: string, score: number, pass: boolean }>} */
  const zoneSummary = [];
  let zonePass = cfg.zones.length === 0;

  if (cfg.zones.length && previousSamples) {
    for (const zone of cfg.zones) {
      const za = sampleRegion(buffer, zone, cfg.sampleStride);
      // Compare against full previous frame samples in zone range of previous buffer — approximate with slice of previous samples by fraction
      const zb = sampleRegionFromSamples(previousSamples, zone);
      const d = deltaScore(za, zb, cfg.pixelDiffThreshold);
      const pass = d.score >= cfg.motionScoreThreshold * (zone.weight || 1);
      zoneSummary.push({ name: zone.name, score: d.score, pass });
      if (pass) zonePass = true;
    }
  } else if (cfg.zones.length === 0) {
    zonePass = true;
  }

  let score = 0;
  let changed = 0;
  let compared = 0;
  let hasBaseline = Boolean(previousSamples && previousSamples.length);

  if (hasBaseline) {
    const d = deltaScore(samples, previousSamples, cfg.pixelDiffThreshold);
    score = d.score;
    changed = d.changed;
    compared = d.compared;
  }

  const brightnessOk =
    brightness >= cfg.brightnessMin && brightness <= cfg.brightnessMax;

  return {
    samples,
    brightness,
    brightnessOk,
    score,
    changed,
    compared,
    hasBaseline,
    zoneSummary,
    zonePass: cfg.zones.length === 0 ? true : zonePass,
  };
}

/**
 * @param {Uint8Array} samples
 * @param {{ start: number, end: number }} zone
 */
function sampleRegionFromSamples(samples, zone) {
  const len = samples.length;
  const start = Math.floor(len * zone.start);
  const end = Math.max(start + 1, Math.floor(len * zone.end));
  return samples.subarray(start, end);
}

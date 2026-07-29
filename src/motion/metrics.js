import jpeg from 'jpeg-js';

/**
 * Lightweight fallback buffer sampling metrics for synthetic tests and invalid images.
 * The normal Reolink path decodes JPEGs and compares grayscale pixels.
 */

/**
 * @typedef {object} PreparedFrame
 * @property {Uint8Array} samples
 * @property {number} width
 * @property {number} height
 * @property {number} sourceWidth
 * @property {number} sourceHeight
 * @property {number} maskedOut
 * @property {number} roiPixels
 * @property {'image' | 'bytes'} mode
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
  let count = 0;
  for (let i = 0; i < samples.length; i += 1) {
    if (samples[i] !== 255) {
      sum += samples[i];
      count += 1;
    }
  }
  return count ? sum / count : 0;
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
  let compared = 0;
  for (let i = 0; i < n; i += 1) {
    // 255 is our ROI mask sentinel; ignore pixels outside configured polygons.
    if (a[i] === 255 && b[i] === 255) continue;
    compared += 1;
    if (Math.abs(a[i] - b[i]) >= pixelDiffThreshold) changed += 1;
  }
  if (compared === 0) return { score: 0, changed: 0, compared: 0 };
  return { score: changed / compared, changed, compared };
}

/**
 * @param {Buffer} buffer
 * @param {object} cfg
 * @returns {PreparedFrame | null}
 */
export function prepareImageFrame(buffer, cfg) {
  if (cfg.imageDecodeEnabled === false) return null;
  let decoded;
  try {
    decoded = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 512 });
  } catch {
    return null;
  }
  if (!decoded?.width || !decoded?.height || !decoded?.data) return null;

  const sourceWidth = decoded.width;
  const sourceHeight = decoded.height;
  const cropTop = Math.min(Math.max(0, cfg.cropTopPx || 0), sourceHeight - 1);
  const croppedHeight = sourceHeight - cropTop;
  const width = Math.max(1, cfg.resizeWidth || sourceWidth);
  const height = Math.max(1, Math.round((croppedHeight * width) / sourceWidth));
  const samples = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sy = cropTop + Math.min(croppedHeight - 1, Math.floor((y * croppedHeight) / height));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
      const si = (sy * sourceWidth + sx) * 4;
      const r = decoded.data[si];
      const g = decoded.data[si + 1];
      const b = decoded.data[si + 2];
      samples[y * width + x] = Math.round((r * 0.299) + (g * 0.587) + (b * 0.114));
    }
  }

  let maskedOut = 0;
  let roiPixels = width * height;
  if (cfg.roiPolygons?.length) {
    roiPixels = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (pointInAnyPolygon(x, y, cfg.roiPolygons)) {
          roiPixels += 1;
        } else {
          samples[y * width + x] = 255;
          maskedOut += 1;
        }
      }
    }
  }

  return {
    samples,
    width,
    height,
    sourceWidth,
    sourceHeight,
    maskedOut,
    roiPixels,
    mode: 'image',
  };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<Array<{ x: number, y: number }>>} polygons
 */
function pointInAnyPolygon(x, y, polygons) {
  for (const polygon of polygons) {
    if (pointInPolygon(x, y, polygon)) return true;
  }
  return false;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Array<{ x: number, y: number }>} polygon
 */
function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * @param {Buffer} buffer
 * @param {object} cfg
 * @param {Uint8Array | null} previousSamples
 */
export function computeFrameMetrics(buffer, cfg, previousSamples) {
  const prepared = prepareImageFrame(buffer, cfg);
  const samples = prepared?.samples || sampleRegion(buffer, cfg.roi, cfg.sampleStride);
  const brightness = meanBrightness(samples);

  /** @type {Array<{ name: string, score: number, pass: boolean }>} */
  const zoneSummary = [];
  let zonePass = cfg.zones.length === 0;

  if (cfg.zones.length && previousSamples) {
    for (const zone of cfg.zones) {
      const za = prepared
        ? sampleRegionFromPrepared(samples, prepared.width, prepared.height, zone)
        : sampleRegion(buffer, zone, cfg.sampleStride);
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
  const hasBaseline = Boolean(previousSamples && previousSamples.length);

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
    mode: prepared?.mode || 'bytes',
    image: prepared ? {
      width: prepared.width,
      height: prepared.height,
      sourceWidth: prepared.sourceWidth,
      sourceHeight: prepared.sourceHeight,
      roiPixels: prepared.roiPixels,
      maskedOut: prepared.maskedOut,
    } : null,
  };
}

/**
 * @param {Uint8Array} samples
 * @param {number} width
 * @param {number} height
 * @param {{ start: number, end: number }} zone
 */
function sampleRegionFromPrepared(samples, width, height, zone) {
  const startY = Math.floor(height * zone.start);
  const endY = Math.max(startY + 1, Math.floor(height * zone.end));
  const out = new Uint8Array((endY - startY) * width);
  let k = 0;
  for (let y = startY; y < endY; y += 1) {
    out.set(samples.subarray(y * width, (y + 1) * width), k);
    k += width;
  }
  return out;
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


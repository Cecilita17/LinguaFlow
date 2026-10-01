/**
 * Non-destructive calibration between subtitle timestamps and original audio.
 * Original SRT/VTT timestamps are always retained on paragraphs; this utility
 * only maps them to the actual media timeline when anchors are present.
 */
export function normalizeAudioSyncAnchors(anchors = []) {
  if (!Array.isArray(anchors)) return [];
  const byParagraphId = new Map();
  anchors.forEach((anchor) => {
    if (!anchor?.paragraphId || !Number.isFinite(anchor.originalTime) || !Number.isFinite(anchor.actualTime)) return;
    byParagraphId.set(String(anchor.paragraphId), {
      paragraphId: String(anchor.paragraphId),
      paragraphIndex: Number.isInteger(anchor.paragraphIndex) ? anchor.paragraphIndex : null,
      originalTime: anchor.originalTime,
      actualTime: Math.max(0, anchor.actualTime),
      offset: anchor.actualTime - anchor.originalTime,
      createdAt: anchor.createdAt || new Date().toISOString()
    });
  });
  return Array.from(byParagraphId.values()).sort((a, b) => a.originalTime - b.originalTime);
}

export function getEffectiveAudioTime(originalTime, anchors = []) {
  const time = Number(originalTime);
  if (!Number.isFinite(time)) return 0;
  const normalized = normalizeAudioSyncAnchors(anchors);
  if (normalized.length === 0) return Math.max(0, time);
  if (normalized.length === 1 || time <= normalized[0].originalTime) {
    return Math.max(0, time + normalized[0].offset);
  }
  const last = normalized[normalized.length - 1];
  if (time >= last.originalTime) return Math.max(0, time + last.offset);

  let low = 0;
  let high = normalized.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (normalized[middle].originalTime <= time) low = middle;
    else high = middle;
  }
  const before = normalized[low];
  const after = normalized[high];
  if (time === before.originalTime) return Math.max(0, before.actualTime);
  if (time === after.originalTime) return Math.max(0, after.actualTime);
  const ratio = (time - before.originalTime) / (after.originalTime - before.originalTime);
  return Math.max(0, before.actualTime + ratio * (after.actualTime - before.actualTime));
}

export function upsertAudioSyncAnchor(anchors, nextAnchor) {
  return normalizeAudioSyncAnchors([
    ...(Array.isArray(anchors) ? anchors.filter((anchor) => anchor?.paragraphId !== nextAnchor?.paragraphId) : []),
    nextAnchor
  ]);
}

export function removeAudioSyncAnchor(anchors, paragraphId) {
  return normalizeAudioSyncAnchors((anchors || []).filter((anchor) => anchor?.paragraphId !== paragraphId));
}

export function buildEffectiveAudioParagraphs(paragraphs = [], anchors = []) {
  return (paragraphs || [])
    .filter((paragraph) => Number.isFinite(paragraph?.audioStart) && Number.isFinite(paragraph?.audioEnd))
    .map((paragraph) => ({
      paragraph,
      start: getEffectiveAudioTime(paragraph.audioStart, anchors),
      end: getEffectiveAudioTime(paragraph.audioEnd, anchors)
    }));
}

export function findEffectiveAudioParagraph(timings = [], currentTime) {
  const time = Number(currentTime);
  if (!Number.isFinite(time) || timings.length === 0) return null;
  let low = 0;
  let high = timings.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (timings[middle].start <= time) {
      candidate = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  // Check the nearby interval first; cue overlaps only need a tiny local scan.
  for (let index = Math.max(0, candidate - 2); index <= Math.min(timings.length - 1, candidate + 2); index += 1) {
    const timing = timings[index];
    if (time >= timing.start && time < timing.end) return timing;
  }
  return null;
}

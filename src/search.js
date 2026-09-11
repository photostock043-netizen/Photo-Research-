// search.js
// Brute-force similarity search over the user's stored vectors, combining:
//   - MobileNet embedding similarity (overall shape/texture)
//   - color histogram similarity (gold vs silver, stone color, etc.)
// MobileNet alone is weak at fine color differences between otherwise
// near-identical product variants, so blending in color similarity
// noticeably improves matching within a product line.
//
// Fine performance-wise up to a few thousand stored images per device.

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const COLOR_WEIGHT = 0.35; // how much color histogram influences the final score
const VISUAL_WEIGHT = 1 - COLOR_WEIGHT;

/**
 * query: { vector, colorHist } — colorHist is optional.
 * record: a stored record with .vector and optionally .colorHist.
 * Falls back to pure visual similarity if either side lacks a colorHist
 * (e.g. records added before this feature existed).
 */
function combinedSimilarity(query, record) {
  const visualSim = cosineSimilarity(query.vector, record.vector);
  if (query.colorHist && record.colorHist) {
    const colorSim = cosineSimilarity(query.colorHist, record.colorHist);
    return VISUAL_WEIGHT * visualSim + COLOR_WEIGHT * colorSim;
  }
  return visualSim;
}

/**
 * query: { vector: Array<number>, colorHist?: Array<number> }
 * allRecords: Array of { id, itemNo, vector, colorHist, imageBlob, ... }
 *   from ProductDB.getAllImageRecords()
 * topK: how many distinct products to return
 * excludeItemNo: optional itemNo to skip (used for "products similar to X",
 *   where X itself shouldn't appear in its own recommendations)
 *
 * Returns: [{ itemNo, similarity, recordId }] sorted by similarity desc,
 * one entry per itemNo. recordId points at whichever stored photo matched
 * best, so the UI can display that exact photo as the result thumbnail.
 */
function searchByVector(query, allRecords, topK = 5, excludeItemNo = null) {
  const bestPerItem = new Map(); // itemNo -> { similarity, recordId }

  for (const record of allRecords) {
    if (excludeItemNo && record.itemNo === excludeItemNo) continue;
    const sim = combinedSimilarity(query, record);
    const current = bestPerItem.get(record.itemNo);
    if (current === undefined || sim > current.similarity) {
      bestPerItem.set(record.itemNo, { similarity: sim, recordId: record.id });
    }
  }

  return Array.from(bestPerItem.entries())
    .map(([itemNo, v]) => ({ itemNo, similarity: v.similarity, recordId: v.recordId }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

window.Search = { cosineSimilarity, combinedSimilarity, searchByVector };

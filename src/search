// search.js
// Brute-force cosine similarity search over the user's stored vectors.
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

/**
 * queryVector: Array<number> from Vision.embedImage()
 * allRecords: Array of { itemNo, vector, ... } from ProductDB.getAllImageRecords()
 * topK: how many distinct products to return
 *
 * Returns: [{ itemNo, similarity }] sorted by similarity desc,
 * one entry per itemNo (using its best-matching stored photo).
 */
function searchByVector(queryVector, allRecords, topK = 5) {
  const bestPerItem = new Map(); // itemNo -> best similarity

  for (const record of allRecords) {
    const sim = cosineSimilarity(queryVector, record.vector);
    const current = bestPerItem.get(record.itemNo);
    if (current === undefined || sim > current) {
      bestPerItem.set(record.itemNo, sim);
    }
  }

  return Array.from(bestPerItem.entries())
    .map(([itemNo, similarity]) => ({ itemNo, similarity }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

window.Search = { cosineSimilarity, searchByVector };

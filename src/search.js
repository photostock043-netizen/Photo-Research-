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
 * allRecords: Array of { id, itemNo, vector, imageBlob, ... } from ProductDB.getAllImageRecords()
 * topK: how many distinct products to return
 *
 * Returns: [{ itemNo, similarity, recordId }] sorted by similarity desc,
 * one entry per itemNo. recordId points at whichever stored photo matched
 * best, so the UI can display that exact photo as the result thumbnail.
 */
function searchByVector(queryVector, allRecords, topK = 5) {
  const bestPerItem = new Map(); // itemNo -> { similarity, recordId }

  for (const record of allRecords) {
    const sim = cosineSimilarity(queryVector, record.vector);
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

window.Search = { cosineSimilarity, searchByVector };

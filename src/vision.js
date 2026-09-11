// vision.js
// Turns a photo into a numeric embedding ("vector") entirely in the browser,
// using MobileNet (TensorFlow.js) — no server, no API key, no cost.

let modelPromise = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  }
  return modelPromise;
}

/**
 * imgElement: an <img> or <canvas> element with the photo already loaded.
 * Returns a plain Array<number> embedding (1024-dim for MobileNet v2).
 */
async function embedImage(imgElement) {
  const model = await loadModel();
  // `true` = return the embedding from the penultimate layer,
  // instead of the 1000-class ImageNet prediction.
  const embeddingTensor = model.infer(imgElement, true);
  const vector = await embeddingTensor.data();
  embeddingTensor.dispose();
  return Array.from(vector);
}

/**
 * Helper: load a File/Blob into an <img> element the model can read.
 */
function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * MobileNet is a general-purpose classifier — it captures overall shape/
 * texture well, but is weak at fine details like "gold vs silver" or
 * "pink stone vs white stone" on otherwise-identical products. A simple
 * color histogram fills that gap cheaply, and gets combined with the
 * MobileNet embedding in search.js.
 *
 * Returns a normalized 216-bin (6x6x6) RGB histogram as a plain Array<number>.
 */
function extractColorHistogram(imgElement, bins = 6) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgElement, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const hist = new Array(bins * bins * bins).fill(0);
  const binSize = 256 / bins;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = Math.min(bins - 1, Math.floor(data[i] / binSize));
    const g = Math.min(bins - 1, Math.floor(data[i + 1] / binSize));
    const b = Math.min(bins - 1, Math.floor(data[i + 2] / binSize));
    hist[r * bins * bins + g * bins + b]++;
    count++;
  }

  return hist.map((v) => v / count);
}

window.Vision = { loadModel, embedImage, loadImageFromBlob, extractColorHistogram };

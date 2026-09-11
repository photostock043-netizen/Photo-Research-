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

window.Vision = { loadModel, embedImage, loadImageFromBlob };

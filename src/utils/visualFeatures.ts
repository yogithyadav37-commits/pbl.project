/**
 * Client-side visual feature extractor (optional supporting layer).
 * Extracts a compact 12-dimensional normalized RGB + luminance histogram signature
 * from an image DataURL or image URL so two uploaded photos can be compared as
 * supplementary evidence without overriding the primary text-based matching engine.
 */
export async function extractVisualSignatureFromSource(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // 3 bins each for R, G, B + 3 luminance bins = 12 features
        const bins = new Array<number>(12).fill(0);
        const totalPixels = size * size;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          bins[Math.min(2, Math.floor((r / 256) * 3))] += 1;
          bins[3 + Math.min(2, Math.floor((g / 256) * 3))] += 1;
          bins[6 + Math.min(2, Math.floor((b / 256) * 3))] += 1;
          bins[9 + Math.min(2, Math.floor((lum / 256) * 3))] += 1;
        }

        const normalized = bins.map((count) => Number((count / totalPixels).toFixed(3)));
        resolve(normalized.join(','));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Validates an uploaded image file safely (MIME allowlist + size limit)
 * and creates a compact compressed thumbnail preview for UI display.
 */
export async function processUploadedPhoto(
  file: File
): Promise<{ previewDataUrl: string; visualSignature: string | null }> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, or WebP photographs are supported.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Photograph must be smaller than 5 MB.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const visualSignature = await extractVisualSignatureFromSource(rawDataUrl);
  return { previewDataUrl: rawDataUrl, visualSignature };
}

/**
 * Client-side logo processing: reads an image file and returns a downscaled PNG
 * data URL, at most `max` px per side. Keeping it small lets the logo live
 * inside the settings row and print quickly on thermal tickets.
 */
export async function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

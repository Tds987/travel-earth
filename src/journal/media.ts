const MAX_EDGE = 1600
const MAX_VIDEO_SECONDS = 30
const MAX_BYTES = 50 * 1024 * 1024 // Supabase free plan per-file limit

/** Shrink photos to ~1600px JPEG: sharp on a phone, a fraction of the data. */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82))
}

/** Clips must be ≤30 s and ≤50 MB; returns an error message or null. */
export function checkVideo(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) return Promise.resolve('That clip is over 50 MB. Try a shorter one.')
  return new Promise((resolve) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src)
      resolve(v.duration > MAX_VIDEO_SECONDS + 0.5 ? 'Clips can be up to 30 seconds.' : null)
    }
    v.onerror = () => resolve(null) // can't read it here; let the upload decide
    v.src = URL.createObjectURL(file)
  })
}

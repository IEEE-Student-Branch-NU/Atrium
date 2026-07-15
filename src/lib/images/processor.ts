import sharp from 'sharp'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  format: 'webp'
}

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageProcessingError'
  }
}

/**
 * Validates the file based on size and mime type.
 * Throws an ImageProcessingError if invalid.
 */
export function validateImage(file: File) {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new ImageProcessingError(`Invalid file type: ${file.type}. Allowed: JPG, PNG, WEBP.`)
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ImageProcessingError(`File size exceeds 10MB limit: ${(file.size / 1024 / 1024).toFixed(2)}MB.`)
  }
}

/**
 * Processes an uploaded image:
 * - Strips EXIF metadata (default behavior when not using withMetadata)
 * - Auto-rotates based on EXIF orientation
 * - Converts to WebP format
 * - Compresses with quality 80-85
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  validateImage(file)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const processedBuffer = await sharp(inputBuffer)
      .rotate() // Auto-rotate based on EXIF
      .webp({ quality: 80, effort: 4 }) // WebP conversion with 80 quality
      .toBuffer()

    // Get metadata of the newly processed WebP image
    const metadata = await sharp(processedBuffer).metadata()

    return {
      buffer: processedBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: 'webp',
    }
  } catch (error: any) {
    if (error instanceof ImageProcessingError) throw error
    throw new ImageProcessingError(`Image processing failed: ${error.message}`)
  }
}

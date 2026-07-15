import ImageKit from 'imagekit'
import { uuidv7 } from 'uuidv7'

export const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || 'dummy_public_key',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'dummy_private_key',
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy_endpoint',
})

export interface ImageKitUploadResult {
  fileId: string
  name: string
  size: number
  filePath: string
  url: string
  fileType: string
  height: number
  width: number
}

/**
 * Uploads an image to ImageKit using UUIDv7 for the filename.
 *
 * @param folder The target folder, e.g. /events/{eventId}/cover
 * @param prefix The prefix for the filename, e.g. 'cover' or 'gallery'
 * @param fileBuffer The buffer containing the processed WEBP image
 * @returns The ImageKit upload result
 */
export async function uploadToImageKit(
  folder: string,
  prefix: string,
  fileBuffer: Buffer
): Promise<ImageKitUploadResult> {
  const fileName = `${prefix}_${uuidv7()}.webp`

  return new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file: fileBuffer, // can be a string (base64) or buffer
        fileName,
        folder,
        useUniqueFileName: false, // We already generate a unique UUIDv7
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error(`ImageKit upload failed: ${error?.message || 'Unknown error'}`))
        } else {
          resolve(result as unknown as ImageKitUploadResult)
        }
      }
    )
  })
}

/**
 * Deletes an image from ImageKit by fileId.
 */
export async function deleteFromImageKit(fileId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imagekit.deleteFile(fileId, (error) => {
      if (error) {
        reject(new Error(`ImageKit delete failed: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

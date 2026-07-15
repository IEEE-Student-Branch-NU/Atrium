// Web Worker for handling bulk image uploads to ImageKit

self.onmessage = async (e) => {
  const { files, eventId, imagekitEndpoint } = e.data
  
  if (!files || files.length === 0) {
    self.postMessage({ type: 'DONE', success: false, error: 'No files provided' })
    return
  }

  try {
    // 1. Fetch authentication parameters
    const authRes = await fetch('/api/imagekit/auth')
    if (!authRes.ok) throw new Error('Failed to fetch auth parameters')
    const authParams = await authRes.json()

    let uploadedCount = 0
    const successfulUploads = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Post progress
      self.postMessage({ 
        type: 'PROGRESS', 
        progress: Math.round((i / files.length) * 100),
        currentFile: file.name
      })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', file.name)
      formData.append('publicKey', authParams.publicKey || '')
      formData.append('signature', authParams.signature)
      formData.append('expire', authParams.expire)
      formData.append('token', authParams.token)
      formData.append('folder', `/events/${eventId}`)

      const uploadRes = await fetch(`${imagekitEndpoint}/api/v1/files/upload`, {
        method: 'POST',
        body: formData
      })

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        successfulUploads.push({
          url: uploadData.url,
          fileId: uploadData.fileId
        })
        uploadedCount++
      } else {
        console.error(`Failed to upload ${file.name}`)
      }
    }

    // 2. Register uploaded images in the database
    if (successfulUploads.length > 0) {
      self.postMessage({ type: 'PROGRESS', progress: 100, status: 'Saving to database...' })
      
      const dbRes = await fetch(`/api/events/${eventId}/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: successfulUploads })
      })
      
      if (!dbRes.ok) throw new Error('Failed to save gallery URLs to database')
    }

    self.postMessage({ 
      type: 'DONE', 
      success: true, 
      uploadedCount, 
      totalFiles: files.length 
    })

  } catch (error) {
    self.postMessage({ type: 'DONE', success: false, error: error.message })
  }
}

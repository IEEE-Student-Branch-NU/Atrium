'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react'

interface PostEventGalleryUploadProps {
  eventId: string
  imagekitEndpoint: string
}

export function PostEventGalleryUpload({ eventId, imagekitEndpoint }: PostEventGalleryUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker('/workers/image-uploader.js')
    
    workerRef.current.onmessage = (e) => {
      const data = e.data
      if (data.type === 'PROGRESS') {
        setProgress(data.progress)
        if (data.status) setStatus(data.status)
        else if (data.currentFile) setStatus(`Uploading ${data.currentFile}...`)
      } else if (data.type === 'DONE') {
        setIsUploading(false)
        if (data.success) {
          setSuccess(true)
          setStatus(`Successfully uploaded ${data.uploadedCount} of ${data.totalFiles} files.`)
          setFiles([])
        } else {
          setError(data.error || 'Upload failed')
        }
      }
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
      setError(null)
      setSuccess(false)
      setProgress(0)
    }
  }

  const handleUpload = () => {
    if (files.length === 0) return
    setIsUploading(true)
    setError(null)
    setSuccess(false)
    setProgress(0)
    setStatus('Preparing to upload...')
    
    workerRef.current?.postMessage({
      files,
      eventId,
      imagekitEndpoint
    })
  }

  return (
    <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Post-Event Gallery Upload</h3>
      
      {!isUploading && !success && (
        <div className="space-y-4">
          <div className="flex items-center justify-center w-full">
            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
                <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-muted-foreground">PNG, JPG or GIF (MAX. 10MB each)</p>
              </div>
              <input id="dropzone-file" type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
            </label>
          </div>
          
          {files.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{files.length} file(s) selected</span>
              <Button onClick={handleUpload}>Start Upload</Button>
            </div>
          )}
        </div>
      )}

      {isUploading && (
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-muted-foreground mt-2">You can navigate away; the upload will continue in the background as long as the tab remains open.</p>
        </div>
      )}

      {error && (
        <div className="flex items-center text-destructive mt-4 text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </div>
      )}

      {success && !isUploading && (
        <div className="flex flex-col items-center justify-center p-4 text-center mt-4">
          <CheckCircle2 className="w-12 h-12 text-primary mb-3" />
          <p className="font-medium">{status}</p>
          <Button variant="outline" className="mt-4" onClick={() => setSuccess(false)}>
            Upload More
          </Button>
        </div>
      )}
    </div>
  )
}

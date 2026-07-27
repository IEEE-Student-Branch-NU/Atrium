'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { submitEvent } from '../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function SubmitButton({ eventId }: { eventId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await submitEvent(eventId)
      toast.success('Event submitted for approval!')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button 
      variant="default" 
      size="sm" 
      className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
      onClick={handleSubmit}
      disabled={isSubmitting}
    >
      <Send className="w-3 h-3" /> 
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </Button>
  )
}

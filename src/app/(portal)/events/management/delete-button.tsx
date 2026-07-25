'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteEvent } from '../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function DeleteButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteEvent(eventId)
      toast.success(`Event "${eventName}" deleted successfully.`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete event')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger 
        render={
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 flex items-center gap-2 text-red-600 border-red-500/30 hover:bg-red-500/10 hover:text-red-700"
            disabled={isDeleting}
          >
            <Trash2 className="w-3 h-3" /> 
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        } 
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the event <strong>"{eventName}"</strong> and remove it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }} 
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? 'Deleting...' : 'Delete Event'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

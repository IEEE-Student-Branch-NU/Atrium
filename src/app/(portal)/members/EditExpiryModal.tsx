'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateMembershipExpiry } from './actions'
import { toast } from 'sonner'
import { DirectoryMember } from '@/lib/queries'

export function EditExpiryModal({
  member,
  isOpen,
  onClose,
}: {
  member: DirectoryMember | null
  isOpen: boolean
  onClose: () => void
}) {
  const [date, setDate] = useState(member?.membership_expiry || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset local state when member changes
  const expectedDate = member?.membership_expiry || ''
  if (date !== expectedDate && !isOpen && !isSubmitting) {
    setDate(expectedDate)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return

    setIsSubmitting(true)
    try {
      await updateMembershipExpiry(member.id, date || null)
      toast.success('Expiry date updated successfully')
      onClose()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update expiry date')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Expiry Date for {member?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Expiry Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to clear the expiry date.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { removePosition } from '@/app/superadmin/actions'

export function RemoveSuperadminDialog({ 
  membershipId, 
  positionName 
}: { 
  membershipId: string
  positionName: string 
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('membership_id', membershipId)
    
    startTransition(async () => {
      const result = await removePosition(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        toast.success(`${positionName} position removed`)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        Remove
      </DialogTrigger>
      <DialogContent className="border-destructive/50">
        <DialogHeader>
          <DialogTitle className="text-destructive">Remove {positionName}</DialogTitle>
          <DialogDescription>
            You are about to remove a highly privileged position from this user. 
            This action requires your Superadmin password to confirm.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="superadmin_password">Superadmin Password</Label>
            <Input 
              id="superadmin_password" 
              name="password" 
              type="password" 
              required 
              placeholder="Enter password..."
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Removal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

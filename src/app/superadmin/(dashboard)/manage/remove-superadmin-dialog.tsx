'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
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
import { removeSuperadmin } from './actions'

export function RemoveSuperadminDialog({ 
  id, 
  email,
  onRemoved
}: { 
  id: string
  email: string
  onRemoved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    const password = formData.get('password') as string
    
    startTransition(async () => {
      const result = await removeSuperadmin(id, password)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        toast.success('Superadmin access revoked successfully.')
        onRemoved()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" />}>
        <Trash2 className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="border-destructive/50">
        <DialogHeader>
          <DialogTitle className="text-destructive">Revoke Superadmin</DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke superadmin access for <strong>{email}</strong>? 
            They will lose all administrative privileges immediately. This requires the Superadmin password.
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
              Revoke Access
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

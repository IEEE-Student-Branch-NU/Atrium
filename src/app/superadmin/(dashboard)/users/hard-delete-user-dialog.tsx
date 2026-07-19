'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { hardDeleteUser } from '@/app/superadmin/actions'

export function HardDeleteUserDialog({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('profile_id', profileId)
    
    startTransition(async () => {
      const result = await hardDeleteUser(formData)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        toast.success('User permanently deleted')
        router.push('/superadmin/users')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" className="w-full sm:w-auto" />}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Hard Delete User
      </DialogTrigger>
      <DialogContent className="border-destructive/50">
        <DialogHeader>
          <DialogTitle className="text-destructive">Permanent Delete Warning</DialogTitle>
          <DialogDescription>
            This action is irreversible. It will permanently delete this user's account, all their history, 
            permissions, event requests, and any pre-approval records.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="superadmin_password">Enter Superadmin Password to Confirm</Label>
            <Input 
              id="superadmin_password" 
              name="password" 
              type="password" 
              required 
              placeholder="Superadmin password"
            />
          </div>
          
          {error && <p className="text-sm text-destructive">{error}</p>}
          
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Confirm Delete
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

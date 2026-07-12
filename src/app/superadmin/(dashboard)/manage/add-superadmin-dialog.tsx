'use client'

import { useState } from 'react'
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
import { PlusCircle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { addSuperadmin } from './actions'

export function AddSuperadminDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    const result = await addSuperadmin(email)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${email} has been granted superadmin access.`)
      setOpen(false)
    }

    setIsPending(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Superadmin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Grant Superadmin Access</DialogTitle>
          <DialogDescription>
            This action gives the user unrestricted access to all data across the platform.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p>
              New superadmins will be assigned the default passphrase <strong>ieee-sbnu-nirma</strong>. Instruct them to log in and change it immediately.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Nirma Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="e.g. 24bce000@nirmauni.ac.in"
              required
              pattern="^[a-zA-Z0-9._%+-]+@nirmauni\.ac\.in$"
              title="Must be a valid @nirmauni.ac.in email address"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? 'Granting Access...' : 'Confirm Access'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

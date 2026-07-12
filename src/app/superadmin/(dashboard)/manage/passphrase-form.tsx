'use client'

import { useState } from 'react'
import { changePassphrase } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { KeyRound, CheckCircle2 } from 'lucide-react'

export function PassphraseForm() {
  const [isPending, setIsPending] = useState(false)
  const [success, setSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const currentPass = formData.get('currentPass') as string
    const newPass = formData.get('newPass') as string
    const confirmPass = formData.get('confirmPass') as string

    if (newPass !== confirmPass) {
      toast.error('New passphrases do not match.')
      setIsPending(false)
      return
    }

    const result = await changePassphrase(currentPass, newPass)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Passphrase updated successfully!')
      setSuccess(true)
      // Reset form
      ;(e.target as HTMLFormElement).reset()
    }
    
    setIsPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <p>Your passphrase was changed securely.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="currentPass">Current Passphrase</Label>
        <Input
          id="currentPass"
          name="currentPass"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPass">New Passphrase</Label>
        <Input
          id="newPass"
          name="newPass"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPass">Confirm New Passphrase</Label>
        <Input
          id="confirmPass"
          name="confirmPass"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        <KeyRound className="mr-2 h-4 w-4" />
        {isPending ? 'Updating...' : 'Update Passphrase'}
      </Button>
    </form>
  )
}

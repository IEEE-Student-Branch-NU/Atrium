'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { elevateToSudo } from './actions'
import { toast } from 'sonner'

export default function SudoPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(async (prevState: any, formData: FormData) => {
    const result = await elevateToSudo(formData)
    if (result.error) {
      return { error: result.error }
    }
    if (result.success) {
      return { success: true }
    }
    return prevState
  }, null)

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error)
    } else if (state?.success) {
      toast.success('Elevation successful')
      router.push('/')
      router.refresh()
    }
  }, [state, router])

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">System Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Enter the access passphrase to continue
          </p>
        </div>
        
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Input 
              id="passphrase" 
              name="passphrase" 
              type="password" 
              placeholder="Passphrase"
              required 
            />
          </div>
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? 'Verifying...' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}

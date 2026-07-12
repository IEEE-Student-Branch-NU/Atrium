'use client'

import { useActionState } from 'react'
import { signInAsSuperadmin } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SuperadminLoginForm() {
  const [state, action, pending] = useActionState(
    async (_prevState: { error?: string } | null, formData: FormData) => {
      const result = await signInAsSuperadmin(formData)
      return result || null
    },
    null
  )

  return (
    <Card className="border-destructive/30 shadow-xl backdrop-blur-sm">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-xl">Authentication Required</CardTitle>
        <CardDescription>
          Enter your superadmin credentials to proceed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state?.error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">{state.error}</p>
          </div>
        )}

        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@nirmauni.ac.in"
              required
              autoComplete="email"
              className="focus-visible:ring-destructive"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passphrase</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="focus-visible:ring-destructive"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
          >
            {pending ? 'Authenticating...' : 'Authenticate'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

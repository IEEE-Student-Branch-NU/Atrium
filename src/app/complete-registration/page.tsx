'use client'

import { useActionState } from 'react'
import { completeRegistration } from '@/app/auth/actions'
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
import { Separator } from '@/components/ui/separator'

export default function CompleteRegistrationPage() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string } | null, formData: FormData) => {
      const result = await completeRegistration(formData)
      return result || null
    },
    null
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Almost there!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your IEEE membership details to continue
          </p>
        </div>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Membership Details</CardTitle>
            <CardDescription>
              You signed in with Google. We just need a few more details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ieeeMembershipId">
                  IEEE Membership ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ieeeMembershipId"
                  name="ieeeMembershipId"
                  type="text"
                  placeholder="e.g. 123456789"
                  required
                  pattern="\d{6,12}"
                  title="Must be 6-12 digits"
                />
                <p className="text-xs text-muted-foreground">
                  Found on your IEEE membership card (Member #)
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="branch">
                    Branch <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="branch"
                    name="branch"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="sbnu" className="bg-background">IEEE SBNU</option>
                    <option value="sight" className="bg-background">IEEE SIGHT</option>
                    <option value="wie" className="bg-background">IEEE WIE</option>
                    <option value="cs" className="bg-background">IEEE CS</option>
                    <option value="itss" className="bg-background">IEEE ITSS</option>
                    <option value="sps" className="bg-background">IEEE SPS</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">
                    Role <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="role"
                    name="role"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Member" className="bg-background">Member</option>
                    <option value="Chair" className="bg-background">Chair</option>
                    <option value="Vice Chair" className="bg-background">Vice Chair</option>
                    <option value="General Secretary" className="bg-background">General Secretary</option>
                    <option value="Technical Head" className="bg-background">Technical Head</option>
                    <option value="Creative Head" className="bg-background">Creative Head</option>
                    <option value="Treasurer" className="bg-background">Treasurer</option>
                    <option value="Web Master" className="bg-background">Web Master</option>
                    <option value="Technical Associate" className="bg-background">Technical Associate</option>
                    <option value="Marketing Associate" className="bg-background">Marketing Associate</option>
                    <option value="MDO" className="bg-background">MDO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    pattern="\+91\s\d{5}\s\d{5}"
                    title="Format: +91 XXXXX XXXXX"
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^\d]/g, '');
                      // Only strip a leading "91" when it's the country code
                      // (i.e. there are extra digits). A valid 10-digit mobile
                      // can itself start with 91, so don't chop it.
                      if (val.length > 10 && val.startsWith('91')) val = val.substring(2);
                      if (val.length > 10) val = val.substring(0, 10);
                      let formatted = val.length > 0 ? '+91' : '';
                      if (val.length > 0) formatted += ' ' + val.substring(0, 5);
                      if (val.length > 5) formatted += ' ' + val.substring(5, 10);
                      e.target.value = formatted;
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="section">IEEE Section</Label>
                  <Input
                    id="section"
                    name="section"
                    type="text"
                    defaultValue="Gujarat Section"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span>
                    If your Membership ID is pre-approved, your account will be
                    activated immediately.
                  </span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Saving...' : 'Complete Registration'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

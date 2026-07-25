'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(
    async (_prevState: { error?: string } | null, formData: FormData) => {
      const result = await signUp(formData)
      return result || null
    },
    null
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-lg px-4 py-8">
        {/* Branding */}
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" x2="19" y1="8" y2="14" />
              <line x1="22" x2="16" y1="11" y2="11" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register as an IEEE SBNU member
          </p>
        </div>

        <Card className="border-border/50 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Registration</CardTitle>
            <CardDescription>
              Your account will be reviewed before access is granted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">{state.error}</p>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              {/* IEEE Membership ID — most important field, put first */}
              <div className="space-y-1.5">
                <Label htmlFor="ieeeMembershipId">
                  IEEE Membership ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ieeeMembershipId"
                  name="ieeeMembershipId"
                  type="text"
                  placeholder="e.g. 102064653"
                  required
                  pattern="\d{9}"
                  maxLength={9}
                  title="Must be exactly 9 digits"
                />
                <p className="text-xs text-muted-foreground">
                  Found on your IEEE membership card (Member #)
                </p>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="fullName">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="As on your IEEE membership"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@nirmauni.ac.in"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">
                    Confirm <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

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
                  <Label htmlFor="phone">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 border-input bg-muted rounded-l-md text-sm text-muted-foreground font-medium">
                      +91
                    </div>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="9876543210"
                      required
                      pattern="\d{10}"
                      title="Format: 10 digit mobile number"
                      maxLength={10}
                      className="rounded-l-none"
                      onChange={(e) => {
                        e.target.value = e.target.value.replace(/[^\d]/g, '').substring(0, 10);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="section">IEEE Section</Label>
                  <Input
                    id="section"
                    name="section"
                    type="text"
                    placeholder="Gujarat Section"
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
                    If your IEEE Membership ID is pre-approved by the MDO, your account
                    will be activated immediately. Otherwise, it will be reviewed manually.
                  </span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Separator />
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

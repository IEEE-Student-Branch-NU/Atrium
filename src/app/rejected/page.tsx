import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { signOut } from '@/app/auth/actions'
import { createAdminClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function RejectedPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, ieee_membership_id, status, rejected_reason')
    .eq('id', session.user.id)
    .single()

  // If approved somehow, redirect to dashboard
  if (profile?.status === 'approved') {
    redirect('/')
  }

  // If still pending, redirect to pending
  if (profile?.status === 'pending') {
    redirect('/pending')
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-destructive/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-lg">
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
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Registration Not Approved
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account registration was reviewed and not approved
          </p>
        </div>

        <Card className="border-destructive/20 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Details</CardTitle>
            <CardDescription>
              See below for the reason provided
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{profile?.full_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{profile?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IEEE Member #</span>
                <span className="font-mono font-medium">
                  {profile?.ieee_membership_id || '—'}
                </span>
              </div>
            </div>

            {profile?.rejected_reason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="mb-1 font-medium text-destructive">Reason:</p>
                <p className="text-muted-foreground">
                  {profile.rejected_reason}
                </p>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>
                If you believe this is an error, please contact the IEEE SBNU
                administration at{' '}
                <span className="font-medium text-foreground">
                  ieee@nirmauni.ac.in
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/complete-registration" className="w-full">
                <Button className="w-full">
                  Update Details & Reapply
                </Button>
              </Link>
              <form action={signOut}>
                <Button variant="outline" type="submit" className="w-full">
                  Sign Out
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

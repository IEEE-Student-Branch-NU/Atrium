import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { signOut } from '@/app/auth/actions'
import { createAdminClient } from '@/utils/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', session.user.id)
    .single()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">🎉 You're in!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
            <p><span className="font-medium text-muted-foreground">Name:</span> {profile?.full_name || session.user.name || '—'}</p>
            <p><span className="font-medium text-muted-foreground">Email:</span> {profile?.email || session.user.email}</p>
            <p><span className="font-medium text-muted-foreground">UID:</span> <code className="text-xs">{session.user.id}</code></p>
          </div>
          <p className="text-sm text-muted-foreground">
            Auth is working. Dashboard UI will be built in the next stage.
          </p>
          <form action={signOut}>
            <Button variant="outline" type="submit" className="w-full">
              Sign Out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

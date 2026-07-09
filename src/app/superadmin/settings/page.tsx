import { auth } from '@/auth'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/utils/supabase/server'
import { Lock, Palette } from 'lucide-react'

export default async function SettingsPage() {
  const session = await auth()

  // Get super admin roster count
  const supabase = createAdminClient()
  const { count } = await supabase.from('superadmins').select('id', {
    count: 'exact',
    head: true,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your super-admin account and global settings.
        </p>
      </div>

      {/* Current Session */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Current Session</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <p className="mt-1 text-sm font-medium">{session?.user?.name ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <p className="mt-1 text-sm font-medium">{session?.user?.email ?? '—'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Super Admin Roster */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Super Admin Roster</CardTitle>
            <CardDescription>Active administrators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Count</label>
              <p className="mt-1 text-2xl font-bold">{count ?? 0}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Managed via database migration; emails are stored hashed.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Theme */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Theme
          </CardTitle>
          <CardDescription>Appearance settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The theme toggle is available in the top navigation bar.
          </p>
        </CardContent>
      </Card>

      {/* Future Policy Controls */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Security Policies</CardTitle>
          <CardDescription>Account and session management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/30 p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password Reset</p>
                <p className="text-xs text-muted-foreground">Manage your password</p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/30 p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Session Length</p>
                <p className="text-xs text-muted-foreground">Configure session timeout</p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming soon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

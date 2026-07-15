import { Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createAdminClient } from '@/utils/supabase/server'
import { AddSuperadminDialog } from './add-superadmin-dialog'
import { PassphraseForm } from './passphrase-form'
import { SuperadminList } from './superadmin-list'
import { Shield } from 'lucide-react'

async function getSuperadmins() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('superadmins')
    .select('id, email, created_at')
    .order('created_at', { ascending: true })
  
  return data || []
}

export default async function ManageSuperadminsPage() {
  const superadmins = await getSuperadmins()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Superadmin Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage system administrators and secure your authentication credentials.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Passphrase Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Security Settings</CardTitle>
            </div>
            <CardDescription>
              Change your superadmin passphrase. It is highly recommended to change it from the default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PassphraseForm />
          </CardContent>
        </Card>

        {/* Superadmin List Card */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg">Authorized Superadmins</CardTitle>
              <CardDescription>
                Users with unrestricted access to the entire platform.
              </CardDescription>
            </div>
            <AddSuperadminDialog />
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>}>
              <SuperadminList superadmins={superadmins} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

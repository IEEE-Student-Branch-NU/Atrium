import { ShieldAlert } from 'lucide-react'
import { SuperadminLoginForm } from './superadmin-login-form'

export default function SuperadminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Animated background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--destructive)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--destructive)/0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Radial gradient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-destructive/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive text-destructive-foreground shadow-lg">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Superadmin Access
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restricted System Administration Portal
          </p>
        </div>

        <SuperadminLoginForm />

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your access is strictly logged and monitored.
        </p>
      </div>
    </div>
  )
}

import { Landmark } from 'lucide-react'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Animated background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Radial gradient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* IEEE Logo & Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Landmark className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            IEEE SBNU Portal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Event Creation & Management Platform
          </p>
        </div>

        <LoginForm />

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Restricted to IEEE SBNU members with{' '}
          <span className="font-medium text-foreground">@nirmauni.ac.in</span>{' '}
          accounts only.
        </p>
      </div>
    </div>
  )
}

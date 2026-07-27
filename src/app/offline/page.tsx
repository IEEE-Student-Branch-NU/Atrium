import type { Metadata } from 'next'
import { WifiOff, RefreshCw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline.',
}

export default function OfflinePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Animated background grid */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Radial gradient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md px-4 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted text-muted-foreground shadow-sm">
          <WifiOff className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">You are offline</h1>
        <p className="mt-3 text-muted-foreground">
          It seems you've lost your internet connection. Please check your network settings and try again.
        </p>
        
        <div className="mt-8 flex flex-col gap-3">
          <a 
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </a>
        </div>
      </div>
    </div>
  )
}

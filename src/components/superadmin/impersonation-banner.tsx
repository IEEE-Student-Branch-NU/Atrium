import { exitWorkspace } from '@/app/superadmin/actions'
import { Button } from '@/components/ui/button'

export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 text-sm">
      <span className="font-medium text-amber-700 dark:text-amber-300">
        Viewing {name}&apos;s workspace — Super Admin mode
      </span>
      <form action={exitWorkspace}>
        <Button type="submit" size="sm" variant="outline">Exit workspace</Button>
      </form>
    </div>
  )
}

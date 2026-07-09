import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { SuperAdminSidebar } from '@/components/superadmin/sidebar'
import { SuperAdminTopBar } from '@/components/superadmin/top-bar'
import { TooltipProvider } from '@/components/ui/tooltip'

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.isSuperAdmin) redirect('/')

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <SuperAdminSidebar user={session.user} />
        <div className="flex-1 flex flex-col">
          <SuperAdminTopBar user={session.user} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  )
}

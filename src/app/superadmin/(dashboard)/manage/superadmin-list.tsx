'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { removeSuperadmin } from './actions'
import { toast } from 'sonner'

type SuperadminListProps = {
  superadmins: { id: string; email: string; created_at: string }[]
}

export function SuperadminList({ superadmins }: SuperadminListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(id: string, email: string) {
    if (!window.confirm(`Are you sure you want to revoke superadmin access for ${email}?`)) {
      return
    }

    setRemovingId(id)
    const result = await removeSuperadmin(id)
    
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Superadmin access revoked successfully.')
    }
    setRemovingId(null)
  }

  if (superadmins.length === 0) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No superadmins found.</div>
  }

  return (
    <div className="rounded-md border border-border/50">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Added On</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {superadmins.map((sa) => (
            <TableRow key={sa.id}>
              <TableCell className="font-medium">{sa.email}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(sa.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemove(sa.id, sa.email)}
                  disabled={removingId === sa.id}
                  title="Revoke access"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

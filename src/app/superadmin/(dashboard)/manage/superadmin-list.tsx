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
import { RemoveSuperadminDialog } from './remove-superadmin-dialog'

type SuperadminListProps = {
  superadmins: { id: string; email: string; created_at: string }[]
}

export function SuperadminList({ superadmins }: SuperadminListProps) {
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
                <RemoveSuperadminDialog 
                  id={sa.id} 
                  email={sa.email} 
                  onRemoved={() => {
                    // Optionally, trigger a router.refresh() if needed, 
                    // but the action already revalidates the path.
                  }} 
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

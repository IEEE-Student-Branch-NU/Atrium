'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Megaphone, AlertTriangle, CheckCircle, XCircle, Info, Clock, ExternalLink } from 'lucide-react'

export function NotificationsList({ notifications }: { notifications: any[] }) {
  if (notifications.length === 0) {
    return (
      <Card className="border-dashed bg-card/30">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Info className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No notifications have been sent yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Notification</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifications.map((n) => {
            const isBroadcast = n.type === 'broadcast'
            return (
              <TableRow key={n.id}>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {n.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-muted-foreground truncate max-w-[300px]" title={n.message}>
                    {n.message}
                  </div>
                </TableCell>
                <TableCell>
                  {n.profiles ? (
                    <div>
                      <div className="font-medium">{n.profiles.full_name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{n.profiles.email}</div>
                    </div>
                  ) : (
                    <Badge variant="secondary">Global Broadcast</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {n.is_read ? (
                    <span className="text-xs text-muted-foreground">Read</span>
                  ) : (
                    <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 shadow-none border-none">
                      Unread
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {new Date(n.created_at).toLocaleString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

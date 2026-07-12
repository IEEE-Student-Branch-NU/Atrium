'use client'

import { useState, useTransition } from 'react'
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
import { Button } from '@/components/ui/button'
import { 
  Megaphone, AlertTriangle, CheckCircle, XCircle, 
  Info, Clock, ExternalLink, MoreHorizontal, Pencil, Trash2 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { editBroadcast, deleteBroadcast } from '@/app/superadmin/actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function NotificationsList({ notifications }: { notifications: any[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  // Edit Dialog State
  const [editingBroadcast, setEditingBroadcast] = useState<any | null>(null)
  const [editType, setEditType] = useState('info')
  const [editTitle, setEditTitle] = useState('')
  const [editMessage, setEditMessage] = useState('')

  function openEditDialog(notification: any) {
    setEditingBroadcast(notification)
    setEditType(notification.type)
    setEditTitle(notification.title)
    setEditMessage(notification.message)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBroadcast) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set('broadcast_id', editingBroadcast.broadcast_id)
      formData.set('title', editTitle)
      formData.set('message', editMessage)
      formData.set('type', editType)

      const result = await editBroadcast(formData)
      if (result.error) {
        toast.error('Failed to edit broadcast', { description: result.error })
      } else {
        toast.success('Broadcast updated', { description: 'The changes have been applied.' })
        setEditingBroadcast(null)
      }
    })
  }

  function handleDelete(broadcast_id: string) {
    if (!confirm('Are you sure you want to delete this broadcast? It will be removed from all users inboxes.')) return

    startTransition(async () => {
      const result = await deleteBroadcast(broadcast_id)
      if (result.error) {
        toast.error('Failed to delete broadcast', { description: result.error })
      } else {
        toast.success('Broadcast deleted')
      }
    })
  }

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
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => {
              const isBroadcast = !!n.broadcast_id
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {n.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {n.title}
                      {n.is_edited && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal">Edited</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate max-w-[300px]" title={n.message}>
                      {n.message}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isBroadcast ? (
                      <div className="flex flex-col">
                        <Badge variant="secondary" className="w-fit">Global Broadcast</Badge>
                        <span className="text-xs text-muted-foreground mt-1">{n.recipient_count} recipients</span>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{n.profiles?.full_name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{n.profiles?.email}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {isBroadcast ? (
                      <div className="text-xs text-muted-foreground">
                        {n.read_count} / {n.recipient_count} read
                      </div>
                    ) : (
                      n.is_read ? (
                        <span className="text-xs text-muted-foreground">Read</span>
                      ) : (
                        <Badge variant="default" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 shadow-none border-none">
                          Unread
                        </Badge>
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(n.created_at).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {isBroadcast && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(n)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Broadcast
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDelete(n.broadcast_id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Broadcast
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Broadcast Dialog */}
      <Dialog open={!!editingBroadcast} onOpenChange={(v) => !v && setEditingBroadcast(null)}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Broadcast</DialogTitle>
              <DialogDescription>
                Updates to this broadcast will instantly reflect in all recipients inboxes.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Notification Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger id="edit-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Default)</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  required
                  placeholder="e.g. System Maintenance"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-message">Message</Label>
                <Textarea
                  id="edit-message"
                  required
                  placeholder="Type your message here..."
                  className="min-h-[100px]"
                  value={editMessage}
                  onChange={e => setEditMessage(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingBroadcast(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

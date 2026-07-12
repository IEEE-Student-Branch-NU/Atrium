'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Send } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendBroadcastMessage } from '@/app/superadmin/actions'

interface SendBroadcastDialogProps {
  branches?: { id: string; name: string }[]
  positions?: { id: string; name: string }[]
}

export function SendBroadcastDialog({ branches = [], positions = [] }: SendBroadcastDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [type, setType] = useState('info')
  const [error, setError] = useState<string | null>(null)
  
  const [selectedBranches, setSelectedBranches] = useState<string[]>([])
  const [selectedPositions, setSelectedPositions] = useState<string[]>([])

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('type', type)
    if (selectedBranches.length > 0) {
      formData.set('branches', JSON.stringify(selectedBranches))
    }
    if (selectedPositions.length > 0) {
      formData.set('positions', JSON.stringify(selectedPositions))
    }

    startTransition(async () => {
      const result = await sendBroadcastMessage(formData)
      if (result.error) {
        setError(result.error)
        toast.error('Failed to send broadcast', { description: result.error })
      } else {
        setOpen(false)
        toast.success('Broadcast sent', { description: 'The targeted active users have received the notification.' })
        router.refresh()
      }
    })
  }

  function toggleBranch(id: string) {
    setSelectedBranches(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  function togglePosition(id: string) {
    setSelectedPositions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone className="mr-2 h-4 w-4" />
          Send Broadcast
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Broadcast Notification</DialogTitle>
            <DialogDescription>
              This message will appear in the inbox of the users who match your selected criteria.
              Leave filters empty to send to everyone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Branches</Label>
                <div className="rounded-md border p-2 h-[120px]">
                  <ScrollArea className="h-full">
                    {branches.length === 0 && <span className="text-xs text-muted-foreground">No branches available</span>}
                    <div className="space-y-2 pr-4">
                      {branches.map(b => (
                        <div key={b.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`branch-${b.id}`} 
                            checked={selectedBranches.includes(b.id)}
                            onCheckedChange={() => toggleBranch(b.id)}
                          />
                          <Label htmlFor={`branch-${b.id}`} className="text-sm font-normal cursor-pointer leading-none">
                            {b.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Positions</Label>
                <div className="rounded-md border p-2 h-[120px]">
                  <ScrollArea className="h-full">
                    {positions.length === 0 && <span className="text-xs text-muted-foreground">No positions available</span>}
                    <div className="space-y-2 pr-4">
                      {positions.map(p => (
                        <div key={p.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`pos-${p.id}`} 
                            checked={selectedPositions.includes(p.id)}
                            onCheckedChange={() => togglePosition(p.id)}
                          />
                          <Label htmlFor={`pos-${p.id}`} className="text-sm font-normal cursor-pointer leading-none">
                            {p.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Notification Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="type">
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
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="e.g. System Maintenance"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                required
                placeholder="Type your message here..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending...' : 'Send Broadcast'}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

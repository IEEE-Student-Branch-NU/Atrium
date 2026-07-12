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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sendBroadcastMessage } from '@/app/superadmin/actions'

export function SendBroadcastDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const [type, setType] = useState('info')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('type', type)

    startTransition(async () => {
      const result = await sendBroadcastMessage(formData)
      if (result.error) {
        setError(result.error)
        toast.error('Failed to send broadcast', { description: result.error })
      } else {
        setOpen(false)
        toast.success('Broadcast sent', { description: 'All active users have received the notification.' })
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); if (!v) setType('info') }}>
      <DialogTrigger
        render={<Button className="gap-2" variant="default" />}
      >
        <Megaphone className="h-4 w-4" />
        Send Broadcast
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Broadcast</DialogTitle>
          <DialogDescription>
            This will instantly send a notification to every user currently active on the portal.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Server Maintenance" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Detailed message..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={type} onValueChange={(v) => { if (v) setType(v) }}>
              <SelectTrigger>
                <SelectValue>
                  {type === 'info' && 'Information'}
                  {type === 'success' && 'Success'}
                  {type === 'warning' && 'Warning'}
                  {type === 'error' && 'Alert / Error'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Information</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Alert / Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              <Send className="h-4 w-4" />
              {isPending ? 'Sending...' : 'Send Broadcast'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

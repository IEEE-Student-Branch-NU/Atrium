'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { createEvent } from '@/app/(portal)/events/actions'
import { toast } from 'sonner'
import { CalendarIcon, MapPin, Users, Mail, Image as ImageIcon } from 'lucide-react'

export function CreateEventForm({ branches, eventTypes }: { branches: any[], eventTypes: any[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    
    const formData = new FormData(e.currentTarget)
    const bannerFile = formData.get('banner_file') as File | null
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      event_date: formData.get('event_date') as string,
      end_date: formData.get('end_date') as string,
      location: formData.get('location') as string,
      capacity: parseInt(formData.get('capacity') as string) || 0,
      organizer_email: formData.get('organizer_email') as string,
      branch_id: formData.get('branch_id') as string,
      event_type_id: formData.get('event_type_id') as string,
      is_free: formData.get('is_free') === 'true',
      registration_url: formData.get('registration_url') as string,
      banner: formData.get('banner') as string || null,
      banner_file: bannerFile?.size ? bannerFile : null,
    }

    if (!data.branch_id || !data.event_type_id) {
      toast.error('Please select a branch and an event type.')
      setIsSubmitting(false)
      return
    }

    try {
      await createEvent(data)
      toast.success('Event created successfully as a draft.')
      router.push('/events/management')
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create event.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>Create New Event</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-2">
            <Label htmlFor="name">Event Name *</Label>
            <Input id="name" name="name" placeholder="E.g., Annual Tech Symposium" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch_id">Organizing Branch *</Label>
              <Select name="branch_id" required>
                <SelectTrigger id="branch_id">
                  <SelectValue placeholder="Select a branch">
                    {(value: any) => value ? branches.find((b: any) => b.id === value)?.name || value : "Select a branch"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} label={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_type_id">Event Type *</Label>
              <Select name="event_type_id" required>
                <SelectTrigger id="event_type_id">
                  <SelectValue placeholder="Select type">
                    {(value: any) => value ? eventTypes.find((et: any) => et.id === value)?.name || value : "Select type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((et) => (
                    <SelectItem key={et.id} value={et.id} label={et.name}>{et.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="Detailed description of the event..." 
              className="min-h-[120px]"
              required 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date" className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                Start Date & Time *
              </Label>
              <Input id="event_date" name="event_date" type="datetime-local" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date" className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                End Date & Time *
              </Label>
              <Input id="end_date" name="end_date" type="datetime-local" required />
              <p className="text-xs text-muted-foreground">The event duration is calculated automatically.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                Location *
              </Label>
              <Input id="location" name="location" placeholder="Venue or Online Link" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacity" className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Capacity (0 for unlimited)
              </Label>
              <Input id="capacity" name="capacity" type="number" min="0" defaultValue="0" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizer_email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Organizer Contact Email *
              </Label>
              <Input id="organizer_email" name="organizer_email" type="email" placeholder="contact@example.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_free">Event Fee *</Label>
              <Select name="is_free" defaultValue="true" required>
                <SelectTrigger id="is_free">
                  <SelectValue placeholder="Select type">
                    {(value: any) => value === "true" ? "Free Event" : value === "false" ? "Paid Event" : "Select type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true" label="Free Event">Free Event</SelectItem>
                  <SelectItem value="false" label="Paid Event">Paid Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_url" className="flex items-center gap-2">
                Registration / Ticketing Link *
              </Label>
              <Input id="registration_url" name="registration_url" type="text" placeholder="Google Form or Konfhub link" required />
              <p className="text-xs text-muted-foreground">Mandatory: Google Form for free, Konfhub/Ticketing for paid.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              Event Poster / Banner (Optional)
            </Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banner_file" className="text-xs text-muted-foreground">Upload File</Label>
                <Input id="banner_file" name="banner_file" type="file" accept="image/*" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner" className="text-xs text-muted-foreground">Or provide Image URL</Label>
                <Input id="banner" name="banner" type="url" placeholder="https://..." />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You can also upload files later from the event dashboard.</p>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-border/50">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Draft Event'}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  )
}

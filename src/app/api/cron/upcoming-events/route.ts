import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const authHeader = request.headers.get('Authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (process.env.CRON_SECRET && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find events happening in the next 24 hours that are published
    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, name, branch_id, event_date, branches(name)')
      .eq('status', 'published')
      .gte('event_date', now.toISOString())
      .lte('event_date', tomorrow.toISOString())

    if (eventsError) {
      console.error('Error fetching upcoming events:', eventsError)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    if (!upcomingEvents || upcomingEvents.length === 0) {
      return NextResponse.json({ message: 'No upcoming events found in the next 24 hours.' })
    }

    let notificationsSent = 0

    for (const event of upcomingEvents) {
      // Find all members of this event's branch
      const { data: members, error: membersError } = await supabase
        .from('memberships')
        .select('profile_id')
        .eq('branch_id', event.branch_id)
        .is('ended_at', null)

      if (membersError || !members) continue

      const notifications = members.map(member => {
        const branchName = Array.isArray(event.branches) 
          ? event.branches[0]?.name 
          : (event.branches as any)?.name
          
        return {
          profile_id: member.profile_id,
          title: 'Upcoming Event Reminder',
          message: `The event "${event.name}" by ${branchName || 'your branch'} is happening within 24 hours!`,
          type: 'normal'
        }
      })

      if (notifications.length > 0) {
        const { error: notifyError } = await supabase.from('notifications').insert(notifications)
        if (!notifyError) {
          notificationsSent += notifications.length
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent ${notificationsSent} notifications for ${upcomingEvents.length} events.` 
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

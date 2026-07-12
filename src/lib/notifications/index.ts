// Barrel for the notification service. Import server-side triggers from here:
//   import { notifyUser, notifyBranch, notifyBroadcast, notifyCustom } from '@/lib/notifications'
export {
  notifyUser,
  notifyBranch,
  notifyBroadcast,
  notifyCustom,
} from './notify'

export {
  NOTIFICATION_EVENTS,
  renderEvent,
  eventSendsEmail,
  type NotificationEventKey,
  type NotificationParams,
  type NotificationAudience,
  type NotificationSeverity,
  type NotificationChannel,
} from './events'

export { CHAIR_POSITION_NAME, isChairPosition, chairBranchIds } from './visibility'

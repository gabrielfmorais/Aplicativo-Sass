// care-tracking — public surface (SPEC-005, SPEC-006).
export {
  CHECKIN_SCALE,
  canCheckIn,
  UNDO_WINDOW_MINUTES,
  RESCHEDULE_HORIZON_DAYS,
  buildTodayView,
  canUndo,
  rescheduleRange,
} from './domain/care-tracking.ts';
export type { CareExecution, CareItem, CareOutcome, CheckIn, TodayView } from './domain/care-tracking.ts';
export type { CareBoard, CareTrackingPort } from './application/ports.ts';

// care-tracking — public surface (SPEC-005, SPEC-006, SPEC-019, SPEC-024, SPEC-025).
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
export {
  WASH_DAY_TECHNIQUES,
  WashDayTechniqueSchema,
  SCALP_FEELS,
  ScalpFeelSchema,
  FINISH_STATUSES,
  FinishStatusSchema,
  type FinishStatus,
  type ScalpFeel,
  type WashDayRecord,
  type WashDayTechnique,
} from './domain/wash-day.ts';
export type { CareBoard, CareTrackingPort, ResumeOutcome, WashDayPort } from './application/ports.ts';
export { CYCLE_WEEKS, buildCycleView, groupIntoWeeks } from './domain/cycle.ts';
export type { CycleView, CycleWeek, PlanWeek } from './domain/cycle.ts';

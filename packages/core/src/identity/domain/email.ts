import { z } from 'zod';

/** Trust-boundary validation for the sign-in form (SPEC-001 FR3/FR8). */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const OtpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'code must be 6 digits');

export type Email = z.infer<typeof EmailSchema>;
export type OtpCode = z.infer<typeof OtpCodeSchema>;

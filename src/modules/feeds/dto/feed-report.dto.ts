import { z } from 'zod';

export const ReportReasonEnum = z.enum([
  'SPAM',
  'INAPPROPRIATE',
  'HARASSMENT',
  'FRAUD',
  'MISLEADING',
  'OTHER',
]);

export const CreateReportDtoSchema = z.object({
  reason: ReportReasonEnum,
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
});

export type CreateReportDto = z.infer<typeof CreateReportDtoSchema>;

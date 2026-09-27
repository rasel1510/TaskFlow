/**
 * src/lib/validators.ts
 *
 * Central Zod v4 schema library for all TaskFlow API inputs.
 *
 * Every API route handler imports and uses these schemas instead of
 * writing ad-hoc typeof/length checks. This gives us:
 *  - Consistent, structured 400 error responses with field-level detail
 *  - A single place to change validation rules across the whole API
 *  - Full TypeScript inference of validated payload types
 *
 * NOTE: This project uses Zod v4 — the API differs from v3:
 *   - `required_error` option → use `error` instead
 *   - `errorMap` on z.enum() → use `error` (string) instead
 *   - z.string({ required_error }) → z.string({ error: '...' })
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Shared enum constants (mirrors Prisma schema enums exactly)
// ---------------------------------------------------------------------------

export const TASK_STATUSES   = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const PROJECT_HEALTHS = ['on_track', 'at_risk', 'delayed', 'completed'] as const;

// ---------------------------------------------------------------------------
// Task schemas
// ---------------------------------------------------------------------------

export const CreateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),

  projectId: z.string().optional(),

  assigneeId: z.string().nullable().optional(),

  status: z
    .enum(TASK_STATUSES, {
      error: `Status must be one of: ${TASK_STATUSES.join(', ')}`,
    })
    .default('todo'),

  priority: z
    .enum(TASK_PRIORITIES, {
      error: `Priority must be one of: ${TASK_PRIORITIES.join(', ')}`,
    })
    .default('medium'),

  dueDate: z.string().optional(),

  estimate: z
    .string()
    .max(20, 'Estimate must be 20 characters or fewer')
    .optional(),

  labels: z
    .array(z.string().max(50))
    .max(10, 'A task can have at most 10 labels')
    .default([]),

  description: z
    .string()
    .max(10_000, 'Description must be 10,000 characters or fewer')
    .optional(),
});

/** Partial version — every field optional for PATCH updates */
export const UpdateTaskSchema = CreateTaskSchema.partial();

/** Query parameters schema for GET /api/tasks with cursor pagination */
export const TaskQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  projectId: z.string().optional(),
  search: z.string().optional(),
  userId: z.string().optional(),
  assigneeId: z.string().optional(),
});

// TypeScript types inferred from schemas
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryInput  = z.infer<typeof TaskQuerySchema>;

// ---------------------------------------------------------------------------
// Project schemas
// ---------------------------------------------------------------------------

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or fewer')
    .trim(),

  description: z
    .string()
    .max(2_000, 'Description must be 2,000 characters or fewer')
    .default(''),

  ownerId: z
    .string()
    .min(1, 'ownerId is required'),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g. #2563EB)')
    .default('#2563EB'),

  startDate: z.string().optional(),
  dueDate:   z.string().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// ---------------------------------------------------------------------------
// Comment schemas
// ---------------------------------------------------------------------------

export const CreateCommentSchema = z.object({
  text: z
    .string()
    .min(1, 'Comment text cannot be empty')
    .max(5000, 'Comment must be 5,000 characters or fewer')
    .trim(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

// ---------------------------------------------------------------------------
// Subtask schemas
// ---------------------------------------------------------------------------

export const CreateSubtaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be 255 characters or fewer')
    .trim(),
});

export const UpdateSubtaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(255, 'Title must be 255 characters or fewer')
    .trim()
    .optional(),
  done: z.boolean().optional(),
});

export type CreateSubtaskInput = z.infer<typeof CreateSubtaskSchema>;
export type UpdateSubtaskInput = z.infer<typeof UpdateSubtaskSchema>;

// ---------------------------------------------------------------------------
// Profile and password schemas
// ---------------------------------------------------------------------------

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be 100 characters or fewer')
    .trim()
    .optional(),
  role: z
    .string()
    .max(100, 'Role must be 100 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  avatar: z
    .string()
    .max(255, 'Avatar must be 255 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  expertise: z
    .array(z.string().trim().min(1))
    .optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(128, 'New password must be 128 characters or fewer'),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const SignupSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or fewer')
    .trim(),

  email: z
    .string()
    .email('Please provide a valid email address')
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or fewer'),

  role: z
    .string()
    .max(50)
    .default('User'),
});

export type SignupInput = z.infer<typeof SignupSchema>;

// ---------------------------------------------------------------------------
// Bulk Task Operations Schema (Step 4.6)
// ---------------------------------------------------------------------------

export const BulkTaskActionSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, 'At least one task ID must be selected')
    .max(100, 'Cannot operate on more than 100 tasks in a single batch'),
  action: z.enum(['update', 'delete'], {
    error: 'Action must be "update" or "delete"',
  }),
  payload: z
    .object({
      status: z.enum(TASK_STATUSES).optional(),
      priority: z.enum(TASK_PRIORITIES).optional(),
      assigneeId: z.string().nullable().optional(),
    })
    .optional(),
});

export type BulkTaskActionInput = z.infer<typeof BulkTaskActionSchema>;

// ---------------------------------------------------------------------------
// Milestone Schemas (Step 4.9)
// ---------------------------------------------------------------------------

export const CreateMilestoneSchema = z.object({
  title: z
    .string()
    .min(1, 'Milestone title cannot be empty')
    .max(150, 'Title must be 150 characters or fewer')
    .trim(),
  description: z.string().max(1000).optional(),
  targetDate: z.string().optional(),
});

export const UpdateMilestoneSchema = CreateMilestoneSchema.partial().extend({
  completed: z.boolean().optional(),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

// ---------------------------------------------------------------------------
// Project Member & RBAC Schemas (Step 4.10)
// ---------------------------------------------------------------------------

export const PROJECT_ROLES = ['OWNER', 'LEAD', 'CONTRIBUTOR', 'VIEWER'] as const;

export const ProjectMemberInviteSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(PROJECT_ROLES).default('CONTRIBUTOR'),
});

export const ProjectMemberUpdateSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});

export type ProjectMemberInviteInput = z.infer<typeof ProjectMemberInviteSchema>;
export type ProjectMemberUpdateInput = z.infer<typeof ProjectMemberUpdateSchema>;

// ---------------------------------------------------------------------------
// Project Lifecycle Transition Schema (Step 4.11)
// ---------------------------------------------------------------------------

export const PROJECT_LIFECYCLE_STATES = [
  'PLANNING',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
] as const;

export const ProjectLifecycleTransitionSchema = z.object({
  targetState: z.enum(PROJECT_LIFECYCLE_STATES),
});

export type ProjectLifecycleTransitionInput = z.infer<
  typeof ProjectLifecycleTransitionSchema
>;

// ---------------------------------------------------------------------------
// Shared error response helper
// ---------------------------------------------------------------------------

/**
 * Returns a standardised 400 NextResponse with structured Zod v4 error details.
 * Import and call this whenever a safeParse fails.
 *
 * @example
 *   const result = CreateTaskSchema.safeParse(body);
 *   if (!result.success) return validationError(result.error);
 */
export function validationError(zodError: z.ZodError): NextResponse {
  // Zod v4: flatten() returns { formErrors, fieldErrors }
  const flat = zodError.flatten();
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        details: flat.fieldErrors,
      },
    },
    { status: 400 }
  );
}

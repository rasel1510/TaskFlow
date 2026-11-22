/**
 * src/lib/validators.ts
 *
 * Central Zod v4 schema library for all FlowSync API inputs.
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
import { toCompanyRole } from '@/lib/companyRoles';

// ---------------------------------------------------------------------------
// Shared enum constants (mirrors Prisma schema enums exactly)
// ---------------------------------------------------------------------------

export const TASK_STATUSES   = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const PROJECT_HEALTHS = ['on_track', 'at_risk', 'delayed', 'completed'] as const;

// ---------------------------------------------------------------------------
// Task schemas
// ---------------------------------------------------------------------------

export const CUSTOM_COLUMN_TYPES = ['text', 'number', 'date', 'checkbox', 'dropdown'] as const;

const CUSTOM_COLUMN_ID = /^col_[a-z0-9]{4,24}$/;

export const CustomColumnSchema = z.object({
  id: z.string().regex(CUSTOM_COLUMN_ID, 'Invalid column id'),
  type: z.enum(CUSTOM_COLUMN_TYPES),
  title: z.string().trim().min(1, 'Column name cannot be empty').max(40, 'Column name must be 40 characters or fewer'),
  options: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export const CustomColumnsSchema = z
  .array(CustomColumnSchema)
  .max(20, 'A project can have at most 20 custom columns')
  .refine(cols => new Set(cols.map(c => c.id)).size === cols.length, 'Duplicate column ids');

export type CustomColumnInput = z.infer<typeof CustomColumnSchema>;

export const CustomFieldsSchema = z
  .record(z.string().regex(CUSTOM_COLUMN_ID), z.union([z.string().max(1000), z.number().finite(), z.boolean(), z.null()]))
  .refine(v => Object.keys(v).length <= 20, 'Too many custom fields');

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

  /** Time spent in whole minutes (max one year); null clears it */
  timeSpent: z.number().int().min(0).max(525_600).nullable().optional(),

  /** Completion date chosen by the user (YYYY-MM-DD); null clears it */
  completedAt: z.string().max(40).nullable().optional(),

  /** Values for project custom columns, keyed by column id. null removes a value. */
  customFields: CustomFieldsSchema.optional(),
});

/**
 * Like `.partial()`, but strips `.default()` wrappers first.
 * Zod's `.partial()` still applies defaults to omitted keys, so a PATCH of
 * `{ title }` would silently reset status/priority/labels to their defaults.
 */
function partialWithoutDefaults<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const shape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => {
      const inner = field instanceof z.ZodDefault ? field.unwrap() : field;
      return [key, (inner as z.ZodType).optional()];
    })
  );
  return z.object(shape) as unknown as ReturnType<z.ZodObject<T>['partial']>;
}

/** Partial version — every field optional for PATCH updates (no defaults applied) */
export const UpdateTaskSchema = partialWithoutDefaults(CreateTaskSchema);

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
// ---------------------------------------------------------------------------
// Project Lifecycle States
// ---------------------------------------------------------------------------

export const PROJECT_LIFECYCLE_STATES = [
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
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
// Project schemas
// ---------------------------------------------------------------------------

/**
 * Project roles: exactly Admin, Project Manager, Member. Older spellings (OWNER, LEAD,
 * CONTRIBUTOR, VIEWER) are still accepted from old clients but are stored as one of the three.
 */
export const PROJECT_ROLES = ['Admin', 'Project Manager', 'Member'] as const;
const PROJECT_ROLE_INPUTS = [...PROJECT_ROLES, 'OWNER', 'LEAD', 'CONTRIBUTOR', 'VIEWER'] as const;
const projectRole = z.enum(PROJECT_ROLE_INPUTS).transform(r => toCompanyRole(r));

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

  customColumns: CustomColumnsSchema.optional(),

  initialMembers: z
    .array(
      z.object({
        userId: z.string().min(1, 'User ID is required'),
        role: projectRole.default('Member'),
      })
    )
    .optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export const UpdateProjectSchema = partialWithoutDefaults(CreateProjectSchema).extend({
  health: z.string().optional(),
  lifecycleState: z.enum(PROJECT_LIFECYCLE_STATES).optional(),
  archived: z.boolean().optional(),
});
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

  teamName: z
    .string()
    .max(80, 'Team name must be 80 characters or fewer')
    .trim()
    .optional(),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be 128 characters or fewer'),

  role: z
    .string()
    .max(50)
    .optional()
    .default('Admin'),
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

export const UpdateMilestoneSchema = partialWithoutDefaults(CreateMilestoneSchema).extend({
  completed: z.boolean().optional(),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

// ---------------------------------------------------------------------------
// Project Member & RBAC Schemas (Step 4.10)
// ---------------------------------------------------------------------------

export const ProjectMemberInviteSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: projectRole.default('Member'),
});

export const BatchProjectMemberInviteSchema = z.object({
  members: z
    .array(
      z.object({
        userId: z.string().min(1, 'User ID is required'),
        role: projectRole.default('Member'),
      })
    )
    .min(1, 'At least one member must be selected'),
});

export const ProjectMemberUpdateSchema = z.object({
  role: projectRole,
});

export const ProjectEmailInviteSchema = z.object({
  email: z.string().email('Please enter a valid email address').trim().toLowerCase(),
  role: projectRole.default('Member'),
});

export type ProjectMemberInviteInput = z.infer<typeof ProjectMemberInviteSchema>;
export type BatchProjectMemberInviteInput = z.infer<typeof BatchProjectMemberInviteSchema>;
export type ProjectMemberUpdateInput = z.infer<typeof ProjectMemberUpdateSchema>;
export type ProjectEmailInviteInput = z.infer<typeof ProjectEmailInviteSchema>;



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

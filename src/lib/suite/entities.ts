/**
 * src/lib/suite/entities.ts — the record types of the Software Company suite.
 *
 * One definition per record type drives the shared API (src/api/suite/[entity]): which module it
 * belongs to, input validation, sorting, search, allowed filters, which fields point to other
 * records (checked to belong to the same company) and which point to people (checked to be members).
 */
import { z } from 'zod';
import type { SuiteModule } from '@/lib/suite/departments';

const str = (max = 200) => z.string().trim().max(max);
const req = (max = 200) => z.string().trim().min(1, 'Required').max(max);
const optId = z.string().trim().max(60).nullable().optional();
const optDate = z.coerce.date().nullable().optional();
const money = z.coerce.number().int().min(0).max(2_000_000_000).nullable().optional();
const url = z
  .string()
  .trim()
  .max(500)
  .refine(v => v === '' || /^https?:\/\//i.test(v), 'Must start with http:// or https://')
  .nullable()
  .optional();
const oneOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);
const checklist = z.array(z.object({ id: str(40), label: str(200), done: z.boolean() })).max(50).nullable().optional();

export interface EntityDef {
  model: string; // Prisma delegate name
  module: SuiteModule;
  label: string;
  create: z.ZodObject<z.ZodRawShape>;
  order: Record<string, 'asc' | 'desc'>;
  search?: string[];
  filters?: string[];
  /** fields holding ids of other company records → the Prisma delegate that must contain them */
  refs?: Record<string, string>;
  /** fields holding user ids → must be members of the company */
  people?: string[];
  /** field set to the creator on create */
  creatorField?: string;
  /** fields whose holder may delete the record (besides Admins / Project Managers) */
  ownerFields?: string[];
  /** listed only — created by integrations, never through this API */
  readOnly?: boolean;
  /** adjusts the data of a new record before it is saved */
  prepare?: (data: Record<string, unknown>) => void;
}

const SLA_HOURS: Record<string, number> = { urgent: 4, high: 8, normal: 24, low: 72 };

const PRODUCT_STATUS = ['active', 'maintained', 'retired'] as const;

export const ENTITIES: Record<string, EntityDef> = {
  /* ── Engineering ── */
  products: {
    model: 'product', module: 'engineering', label: 'Product',
    create: z.object({ name: req(120), description: str(2000).optional(), status: oneOf(PRODUCT_STATUS).optional(), ownerId: optId, color: str(20).optional() }),
    order: { name: 'asc' }, search: ['name'], filters: ['status'], people: ['ownerId'], ownerFields: ['ownerId'],
  },
  components: {
    model: 'productComponent', module: 'engineering', label: 'Component',
    create: z.object({
      productId: req(60), name: req(120),
      kind: oneOf(['web', 'mobile', 'api', 'admin', 'worker', 'other'] as const).optional(),
      techStack: z.array(str(40)).max(20).optional(),
      repoFullName: z.string().trim().max(140).regex(/^$|^[\w.-]+\/[\w.-]+$/, 'Use owner/repo').nullable().optional(),
      vercelProjectId: str(80).nullable().optional(),
      liveUrl: url, stagingUrl: url, docsUrl: url, ownerId: optId,
      status: oneOf(PRODUCT_STATUS).optional(),
    }),
    order: { name: 'asc' }, search: ['name'], filters: ['productId', 'kind'], refs: { productId: 'product' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  sprints: {
    model: 'sprint', module: 'engineering', label: 'Sprint',
    create: z.object({ name: req(120), goal: str(500).optional(), startDate: z.coerce.date(), endDate: z.coerce.date(), projectId: optId, status: oneOf(['planned', 'active', 'completed'] as const).optional() }),
    order: { startDate: 'desc' }, search: ['name'], filters: ['status', 'projectId'], refs: { projectId: 'project' },
  },
  releases: {
    model: 'release', module: 'engineering', label: 'Release',
    create: z.object({
      version: z.string().trim().min(1).max(40), title: str(160).optional(), productId: optId,
      kind: oneOf(['major', 'minor', 'patch', 'hotfix'] as const).optional(),
      stage: oneOf(['planned', 'development', 'code_freeze', 'qa', 'staging', 'released', 'rolled_back'] as const).optional(),
      targetDate: optDate, notes: str(20000).optional(), checklist, supportEndsAt: optDate,
    }),
    order: { createdAt: 'desc' }, search: ['version', 'title'], filters: ['productId', 'stage'], refs: { productId: 'product' }, creatorField: 'createdById', ownerFields: ['createdById'],
  },
  incidents: {
    model: 'incident', module: 'engineering', label: 'Incident',
    create: z.object({
      title: req(200), severity: oneOf(['sev1', 'sev2', 'sev3', 'sev4'] as const).optional(),
      status: oneOf(['investigating', 'identified', 'monitoring', 'resolved'] as const).optional(),
      ownerId: optId, componentId: optId, summary: str(5000).optional(), postmortem: str(20000).optional(), startedAt: optDate,
    }),
    order: { startedAt: 'desc' }, search: ['title'], filters: ['status', 'severity'], refs: { componentId: 'productComponent' }, people: ['ownerId'], creatorField: 'createdById', ownerFields: ['ownerId', 'createdById'],
  },
  oncall: {
    model: 'onCallShift', module: 'engineering', label: 'On-call shift',
    create: z.object({ userId: req(60), startsAt: z.coerce.date(), endsAt: z.coerce.date(), note: str(200).optional() }),
    order: { startsAt: 'asc' }, filters: ['userId'], people: ['userId'],
  },
  docs: {
    model: 'docPage', module: 'engineering', label: 'Document',
    create: z.object({
      title: req(200), kind: oneOf(['wiki', 'prd', 'tech_spec', 'decision', 'runbook', 'meeting'] as const).optional(),
      body: str(100_000).optional(), productId: optId, status: oneOf(['draft', 'in_review', 'approved'] as const).optional(),
    }),
    order: { updatedAt: 'desc' }, search: ['title'], filters: ['kind', 'productId', 'status'], refs: { productId: 'product' }, creatorField: 'authorId', ownerFields: ['authorId'],
  },
  testcases: {
    model: 'testCase', module: 'engineering', label: 'Test case',
    create: z.object({ title: req(200), steps: str(5000).optional(), expected: str(2000).optional(), priority: oneOf(['low', 'medium', 'high'] as const).optional(), productId: optId }),
    order: { createdAt: 'desc' }, search: ['title'], filters: ['productId'], refs: { productId: 'product' }, creatorField: 'createdById', ownerFields: ['createdById'],
  },
  testruns: {
    model: 'testRun', module: 'engineering', label: 'Test run',
    create: z.object({ name: req(160), releaseId: optId, results: z.record(z.string(), oneOf(['pass', 'fail', 'blocked', 'untested'] as const)).nullable().optional() }),
    order: { createdAt: 'desc' }, filters: ['releaseId', 'status'], refs: { releaseId: 'release' }, creatorField: 'createdById', ownerFields: ['createdById'],
  },
  assets: {
    model: 'infraAsset', module: 'engineering', label: 'Asset',
    create: z.object({
      category: oneOf(['domain', 'service', 'tool', 'license', 'secret'] as const), name: req(160), provider: str(120).optional(),
      ownerId: optId, costCents: money, currency: str(3).optional(), billingCycle: oneOf(['monthly', 'yearly', 'one_time'] as const).optional(),
      renewsAt: optDate, expiresAt: optDate, location: str(200).optional(), lastRotatedAt: optDate, notes: str(2000).optional(),
    }),
    order: { name: 'asc' }, search: ['name', 'provider'], filters: ['category'], people: ['ownerId'], ownerFields: ['ownerId'],
  },

  code: {
    model: 'codeLink', module: 'engineering', label: 'Pull request', readOnly: true,
    create: z.object({}),
    order: { updatedAt: 'desc' }, search: ['title', 'repo', 'branch'], filters: ['state', 'repo', 'taskId'],
  },
  deployments: {
    model: 'deployment', module: 'engineering', label: 'Deployment',
    create: z.object({
      projectName: req(120), environment: oneOf(['production', 'staging', 'preview', 'development'] as const),
      state: oneOf(['queued', 'building', 'ready', 'error', 'canceled'] as const).optional(), url, version: str(40).nullable().optional(),
      commitSha: str(64).nullable().optional(), commitMessage: str(300).nullable().optional(), branch: str(120).nullable().optional(),
      componentId: optId, deployedAt: optDate,
    }),
    order: { deployedAt: 'desc' }, search: ['projectName', 'branch', 'commitMessage'], filters: ['environment', 'state', 'componentId', 'provider'],
    refs: { componentId: 'productComponent' },
    prepare: d => {
      d.provider = 'manual';
      d.externalId = `manual:${crypto.randomUUID()}`;
      d.creator = d.creator ?? null;
    },
  },

  /* ── Sales ── */
  contacts: {
    model: 'contact', module: 'sales', label: 'Contact',
    create: z.object({
      name: req(120), email: z.string().trim().max(200).email('Invalid email').or(z.literal('')).nullable().optional(),
      phone: str(40).nullable().optional(), companyName: str(160).optional(), jobTitle: str(120).optional(),
      source: oneOf(['website', 'referral', 'linkedin', 'facebook', 'event', 'cold_call', 'campaign', 'other'] as const).optional(),
      campaignId: optId, ownerId: optId, notes: str(5000).optional(),
    }),
    order: { updatedAt: 'desc' }, search: ['name', 'companyName', 'email'], filters: ['source', 'ownerId'], refs: { campaignId: 'campaign' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  deals: {
    model: 'deal', module: 'sales', label: 'Deal',
    create: z.object({
      title: req(160), contactId: optId, companyName: str(160).optional(), valueCents: money, currency: str(3).optional(),
      stage: oneOf(['new', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'won', 'lost'] as const).optional(),
      probability: z.coerce.number().int().min(0).max(100).optional(), expectedCloseAt: optDate, ownerId: optId, productId: optId,
      nextStep: str(300).optional(), requirements: str(10000).optional(), lostReason: str(300).optional(),
      source: oneOf(['website', 'referral', 'linkedin', 'facebook', 'event', 'cold_call', 'campaign', 'other'] as const).optional(), campaignId: optId,
    }),
    order: { updatedAt: 'desc' }, search: ['title', 'companyName'], filters: ['stage', 'ownerId', 'contactId'],
    refs: { contactId: 'contact', productId: 'product', campaignId: 'campaign' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  activities: {
    model: 'salesActivity', module: 'sales', label: 'Activity',
    create: z.object({
      subject: req(200), type: oneOf(['call', 'meeting', 'email', 'note', 'follow_up', 'demo'] as const).optional(),
      dealId: optId, contactId: optId, dueAt: optDate, doneAt: optDate, ownerId: optId,
    }),
    order: { createdAt: 'desc' }, search: ['subject'], filters: ['dealId', 'contactId', 'ownerId', 'type'], refs: { dealId: 'deal', contactId: 'contact' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  proposals: {
    model: 'proposal', module: 'sales', label: 'Proposal',
    create: z.object({
      title: req(160), dealId: optId, currency: str(3).optional(), validUntil: optDate, notes: str(5000).optional(),
      items: z.array(z.object({ name: req(200), qty: z.coerce.number().int().min(1).max(100000), priceCents: z.coerce.number().int().min(0).max(2_000_000_000) })).max(100).nullable().optional(),
      status: oneOf(['draft', 'sent', 'viewed', 'accepted', 'declined'] as const).optional(),
    }),
    order: { updatedAt: 'desc' }, search: ['title'], filters: ['status', 'dealId'], refs: { dealId: 'deal' }, creatorField: 'createdById', ownerFields: ['createdById'],
  },
  targets: {
    model: 'salesTarget', module: 'sales', label: 'Target',
    create: z.object({ userId: optId, period: z.string().trim().regex(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/, 'Use 2026-11 or 2026-Q4'), amountCents: z.coerce.number().int().min(0).max(2_000_000_000), currency: str(3).optional() }),
    order: { period: 'desc' }, filters: ['period', 'userId'], people: ['userId'],
  },

  /* ── Marketing ── */
  campaigns: {
    model: 'campaign', module: 'marketing', label: 'Campaign',
    create: z.object({
      name: req(160), goal: str(500).optional(), channels: z.array(str(40)).max(12).optional(), budgetCents: money, spentCents: money,
      currency: str(3).optional(), clicks: z.coerce.number().int().min(0).nullable().optional(), startDate: optDate, endDate: optDate,
      status: oneOf(['planned', 'active', 'completed'] as const).optional(), ownerId: optId, releaseId: optId, notes: str(5000).optional(),
    }),
    order: { createdAt: 'desc' }, search: ['name'], filters: ['status'], refs: { releaseId: 'release' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  content: {
    model: 'contentItem', module: 'marketing', label: 'Content',
    create: z.object({
      title: req(200), channel: oneOf(['blog', 'social', 'email', 'video', 'newsletter', 'website', 'announcement'] as const).optional(),
      stage: oneOf(['idea', 'writing', 'design', 'review', 'scheduled', 'published'] as const).optional(),
      publishAt: optDate, ownerId: optId, url: z.string().trim().max(500).optional(), notes: str(5000).optional(), campaignId: optId, releaseId: optId,
    }),
    order: { updatedAt: 'desc' }, search: ['title'], filters: ['stage', 'channel', 'campaignId', 'releaseId'], refs: { campaignId: 'campaign', releaseId: 'release' }, people: ['ownerId'], ownerFields: ['ownerId'],
  },
  brand: {
    model: 'brandAsset', module: 'marketing', label: 'Brand asset',
    create: z.object({
      name: req(120), kind: oneOf(['logo', 'color', 'font', 'image', 'template', 'guideline', 'link'] as const).optional(),
      value: z.string().trim().min(1).max(1_500_000), notes: str(1000).optional(),
    }),
    order: { createdAt: 'desc' }, search: ['name'], filters: ['kind'],
  },

  /* ── Customers ── */
  accounts: {
    model: 'customerAccount', module: 'customers', label: 'Customer',
    create: z.object({
      name: req(160), plan: str(80).optional(), mrrCents: z.coerce.number().int().min(0).max(2_000_000_000).optional(), currency: str(3).optional(),
      status: oneOf(['onboarding', 'active', 'at_risk', 'churned'] as const).optional(), managerId: optId, startDate: optDate, renewalDate: optDate,
      onboarding: checklist, dealId: optId, notes: str(5000).optional(),
    }),
    order: { name: 'asc' }, search: ['name'], filters: ['status', 'managerId'], refs: { dealId: 'deal' }, people: ['managerId'], ownerFields: ['managerId'],
  },
  tickets: {
    model: 'ticket', module: 'customers', label: 'Ticket',
    create: z.object({
      subject: req(200), description: str(10000).optional(), accountId: optId, contactEmail: z.string().trim().max(200).optional(),
      priority: oneOf(['low', 'normal', 'high', 'urgent'] as const).optional(), status: oneOf(['open', 'pending', 'resolved', 'closed'] as const).optional(),
      assigneeId: optId,
    }),
    order: { createdAt: 'desc' }, search: ['subject', 'contactEmail'], filters: ['status', 'priority', 'assigneeId', 'accountId'], refs: { accountId: 'customerAccount' }, people: ['assigneeId'], creatorField: 'createdById', ownerFields: ['assigneeId', 'createdById'],
    prepare: d => {
      d.slaDueAt = new Date(Date.now() + (SLA_HOURS[String(d.priority || 'normal')] ?? 24) * 3600_000);
    },
  },
  requests: {
    model: 'featureRequest', module: 'customers', label: 'Feature request',
    create: z.object({
      title: req(200), description: str(5000).optional(), productId: optId,
      status: oneOf(['open', 'planned', 'in_progress', 'shipped', 'declined'] as const).optional(), releaseId: optId,
    }),
    order: { createdAt: 'desc' }, search: ['title'], filters: ['status', 'productId'], refs: { productId: 'product', releaseId: 'release' }, creatorField: 'createdById', ownerFields: ['createdById'],
  },
  nps: {
    model: 'npsResponse', module: 'customers', label: 'Feedback',
    create: z.object({ accountId: optId, score: z.coerce.number().int().min(0).max(10), comment: str(2000).optional() }),
    order: { createdAt: 'desc' }, filters: ['accountId'], refs: { accountId: 'customerAccount' },
  },
  changes: {
    model: 'changeRequest', module: 'customers', label: 'Change request',
    create: z.object({
      projectId: req(60), title: req(200), description: str(5000).optional(), estimateHours: z.coerce.number().int().min(0).max(100000).nullable().optional(),
      priceCents: money, currency: str(3).optional(), status: oneOf(['requested', 'estimated', 'approved', 'rejected'] as const).optional(), requestedBy: str(120).optional(),
    }),
    order: { createdAt: 'desc' }, filters: ['projectId', 'status'], refs: { projectId: 'project' },
  },
  time: {
    model: 'timeEntry', module: 'customers', label: 'Time entry',
    create: z.object({
      projectId: optId, taskId: optId, minutes: z.coerce.number().int().min(1).max(24 * 60), billable: z.boolean().optional(),
      rateCents: money, note: str(300).optional(), date: optDate,
    }),
    order: { date: 'desc' }, filters: ['projectId', 'userId'], refs: { projectId: 'project' }, creatorField: 'userId', ownerFields: ['userId'],
  },
  payments: {
    model: 'paymentMilestone', module: 'customers', label: 'Payment milestone',
    create: z.object({
      projectId: req(60), title: req(160), amountCents: z.coerce.number().int().min(0).max(2_000_000_000), currency: str(3).optional(),
      dueDate: optDate, status: oneOf(['pending', 'invoiced', 'paid'] as const).optional(),
    }),
    order: { createdAt: 'asc' }, filters: ['projectId', 'status'], refs: { projectId: 'project' },
  },
};

export type EntityName = keyof typeof ENTITIES;

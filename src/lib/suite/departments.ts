/**
 * src/lib/suite/departments.ts — Software Company suite: departments, job titles and module access.
 *
 * Shared by the server (access checks) and the browser (navigation). Permissions still come from the
 * company role (Admin / Project Manager / Member); the department decides which modules a person
 * works in, so a Sales Executive never sees deployment tools and a developer never sees deal values.
 */

export const DEPARTMENTS = ['engineering', 'product', 'sales', 'marketing', 'customer', 'leadership'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  engineering: 'Engineering',
  product: 'Product & Design',
  sales: 'Sales',
  marketing: 'Marketing',
  customer: 'Customer',
  leadership: 'Leadership & Operations',
};

export const JOB_TITLES: Record<Department, string[]> = {
  engineering: [
    'Engineering Manager', 'Tech Lead', 'Frontend Engineer', 'Backend Engineer', 'Full-stack Engineer',
    'Mobile Engineer', 'DevOps / SRE', 'QA Engineer', 'Security Engineer', 'Data / ML Engineer', 'Intern',
  ],
  product: ['Product Manager', 'Product Owner', 'UI/UX Designer', 'Business Analyst'],
  sales: ['Sales Executive', 'Sales Manager', 'Business Development', 'Account Manager', 'Pre-sales / Solutions Engineer'],
  marketing: [
    'Marketing Manager', 'Digital Marketer', 'Content Writer', 'SEO Specialist', 'Social Media Manager',
    'Ads Specialist', 'Graphic Designer',
  ],
  customer: ['Customer Success Manager', 'Support Agent', 'Onboarding Specialist'],
  leadership: ['CEO / Founder', 'CTO', 'COO', 'HR', 'Finance'],
};

export const SUITE_MODULES = ['engineering', 'sales', 'marketing', 'customers', 'insights'] as const;
export type SuiteModule = (typeof SUITE_MODULES)[number];

export const MODULE_LABELS: Record<SuiteModule, string> = {
  engineering: 'Engineering',
  sales: 'Sales',
  marketing: 'Marketing',
  customers: 'Customers',
  insights: 'Insights',
};

/** Which departments work in each module (Admins and Project Managers see every module). */
const MODULE_DEPARTMENTS: Record<SuiteModule, Department[]> = {
  engineering: ['engineering', 'product', 'leadership'],
  sales: ['sales', 'leadership'],
  marketing: ['marketing', 'sales', 'leadership'],
  customers: ['customer', 'sales', 'product', 'engineering', 'leadership'],
  insights: ['engineering', 'product', 'sales', 'marketing', 'customer', 'leadership'],
};

export function isDepartment(value: unknown): value is Department {
  return typeof value === 'string' && (DEPARTMENTS as readonly string[]).includes(value);
}

/** People without a department are treated as engineers (most of a software company). */
export function effectiveDepartment(value: string | null | undefined): Department {
  return isDepartment(value) ? value : 'engineering';
}

/** True for company roles that manage the whole company (they see every module). */
export function isCompanyManager(role: string | null | undefined): boolean {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'project manager' || r === 'owner' || r === 'super admin';
}

export function canUseModule(module: SuiteModule, department: string | null | undefined, role: string | null | undefined): boolean {
  if (isCompanyManager(role)) return true;
  return MODULE_DEPARTMENTS[module].includes(effectiveDepartment(department));
}

/** Insights sections each department may see. */
export function insightSections(department: string | null | undefined, role: string | null | undefined) {
  const d = effectiveDepartment(department);
  const all = isCompanyManager(role) || d === 'leadership';
  return {
    overview: all,
    engineering: all || d === 'engineering' || d === 'product',
    sales: all || d === 'sales',
    marketing: all || d === 'marketing' || d === 'sales',
    customers: all || d === 'customer' || d === 'sales',
  };
}

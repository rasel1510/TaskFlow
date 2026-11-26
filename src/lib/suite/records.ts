/**
 * src/lib/suite/records.ts — helpers shared by the suite record API.
 */
import prisma from '@/lib/prisma';
import type { EntityDef } from '@/lib/suite/entities';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = {
  findMany: (args: any) => Promise<any[]>;
  findFirst: (args: any) => Promise<any>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
};

/** The Prisma model delegate for a record type (names come only from the fixed entity registry). */
export function delegate(model: string): Delegate {
  const d = (prisma as unknown as Record<string, Delegate>)[model];
  if (!d) throw new Error(`Unknown model ${model}`);
  return d;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Empty strings in optional id fields mean "none". */
export function cleanInput(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = (k.endsWith('Id') && v === '') ? null : v;
  }
  return out;
}

/**
 * Linked records must belong to the same company, and people must be members of it.
 * Returns an error message, or null when everything checks out.
 */
export async function checkLinks(def: EntityDef, data: Record<string, unknown>, teamId: string): Promise<string | null> {
  for (const [field, model] of Object.entries(def.refs || {})) {
    const id = data[field];
    if (typeof id !== 'string' || !id) continue;
    const found = await delegate(model).findFirst({ where: { id, teamId }, select: { id: true } });
    if (!found) return `The linked ${field.replace(/Id$/, '')} was not found in this company.`;
  }
  const people = (def.people || []).map(f => data[f]).filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (people.length) {
    const members = await prisma.teamMembership.count({ where: { teamId, userId: { in: Array.from(new Set(people)) } } });
    if (members !== new Set(people).size) return 'Choose people who are members of this company.';
  }
  return null;
}

/** May this person delete the record? Managers always; otherwise its owner / creator. */
export function canDelete(def: EntityDef, record: Record<string, unknown>, userId: string, isManager: boolean): boolean {
  if (isManager) return true;
  return (def.ownerFields || []).some(f => record[f] === userId);
}

'use client';

/**
 * Stage 0 panels for the existing Settings and Team pages:
 *   - SuiteSettingsPanel: Admins switch the Software Company tools on/off for an existing company
 *   - DepartmentsPanel:   department and job title of every member (managers edit; people set their own title)
 * Both render nothing for people / companies they don't apply to.
 */
import React, { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { suiteApi } from '@/lib/suite/useRecords';
import { refreshSuite, useSuite } from '@/lib/suite/useSuite';
import { DEPARTMENTS, DEPARTMENT_LABELS, JOB_TITLES, isDepartment, type Department } from '@/lib/suite/departments';
import { Avatar, Button, Select } from '@/components/suite/ui';

export function SuiteSettingsPanel() {
  const toast = useToast();
  const { suite } = useSuite();
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  if (!suite || (!suite.enabled && !suite.canEnable)) return null;

  const set = async (enabled: boolean) => {
    setBusy(true);
    try {
      await suiteApi('/api/suite/context', { method: 'PATCH', body: JSON.stringify({ enabled }) });
      refreshSuite();
      toast.success(enabled ? 'Software company tools are on' : 'Software company tools are off');
      setConfirmOff(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[#111111]">Software company tools</h3>
          <p className="mt-0.5 text-[12.5px] text-[rgba(17,17,17,0.55)]">
            Engineering (sprints, releases, GitHub, Vercel, incidents), Sales, Marketing, Customers and Insights — shown to each person by department.
          </p>
        </div>
        {suite.canEnable ? (
          suite.enabled ? (
            confirmOff ? (
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setConfirmOff(false)}>Keep on</Button>
                <Button variant="danger" size="sm" onClick={() => set(false)} disabled={busy}>Turn off (data is kept)</Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setConfirmOff(true)}>Turn off</Button>
            )
          ) : (
            <Button variant="primary" size="sm" onClick={() => set(true)} disabled={busy}>{busy ? 'Turning on…' : 'Turn on'}</Button>
          )
        ) : (
          <span className="text-[12.5px] text-emerald-700 shrink-0">On</span>
        )}
      </div>
    </section>
  );
}

export function DepartmentsPanel() {
  const toast = useToast();
  const { suite } = useSuite();
  const [saving, setSaving] = useState<string | null>(null);
  if (!suite?.enabled || !suite.members?.length) return null;
  const canManage = Boolean(suite.me?.isManager);

  const save = async (userId: string, data: { department?: Department; jobTitle?: string }) => {
    setSaving(userId);
    try {
      await suiteApi('/api/suite/members', { method: 'PATCH', body: JSON.stringify({ userId, ...data }) });
      refreshSuite();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-[#111111]">Departments & job titles</h2>
        <p className="mt-0.5 text-[12.5px] text-[rgba(17,17,17,0.55)]">
          The department decides which areas each person works in (Engineering, Sales, Marketing, Customers). Permissions still follow the role above.
        </p>
      </div>
      <ul className="rounded-xl border border-[#E5E7EB] bg-white divide-y divide-[#F0F0F0]">
        {suite.members.map(m => {
          const self = m.id === suite.me?.id;
          const titles = JOB_TITLES[m.department] ?? [];
          return (
            <li key={m.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2.5 min-w-0 sm:w-64">
                <Avatar name={m.name} size={26} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#111111] truncate">{m.name}{self && <span className="text-neutral-400 font-normal"> (you)</span>}</p>
                  <p className="text-[11.5px] text-neutral-500 truncate">{m.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 flex-1">
                <Select
                  aria-label={`Department of ${m.name}`}
                  value={m.department}
                  disabled={!canManage || saving === m.id}
                  onChange={e => isDepartment(e.target.value) && save(m.id, { department: e.target.value, jobTitle: '' })}
                  options={DEPARTMENTS.map(d => ({ value: d, label: DEPARTMENT_LABELS[d] }))}
                />
                <Select
                  aria-label={`Job title of ${m.name}`}
                  value={titles.includes(m.jobTitle) ? m.jobTitle : ''}
                  disabled={(!canManage && !self) || saving === m.id}
                  onChange={e => save(m.id, { jobTitle: e.target.value })}
                  options={titles.map(t => ({ value: t, label: t }))}
                  placeholder="Choose job title"
                />
              </div>
              {!m.departmentSet && canManage && <span className="text-[11px] text-amber-600 sm:w-24">Not set yet</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

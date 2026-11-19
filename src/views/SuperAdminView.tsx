'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/Toast';

interface CompanyOwner {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

interface CompanyMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  plan: string;
  subscriptionStatus: string;
  createdAt: string;
}

interface CompanyProject {
  id: string;
  name: string;
  color: string;
  health: string;
  progress: number;
  lifecycleState: string;
  createdAt: string;
  _count: { tasks: number };
}

interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  isPlatformOwner: boolean;
  createdAt: string;
  updatedAt: string;
  plan: 'free' | 'pro';
  status: 'active' | 'past_due' | 'suspended';
  membersCount: number;
  projectsCount: number;
  tasksCount: number;
  owner: CompanyOwner | null;
  members: CompanyMember[];
  projects: CompanyProject[];
}

interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  plan: string;
  subscriptionStatus: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
  teamId: string | null;
  team: { id: string; name: string; slug: string } | null;
  isSuperAdmin: boolean;
  isPlatformOwnerMember: boolean;
  _count?: {
    tasksAssigned: number;
    tasksCreated: number;
    projectsOwned: number;
  };
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  planName: string;
  billingCycle: string;
  paymentMethod: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    plan: string;
    team: { id: string; name: string; slug: string } | null;
  };
}

interface PlatformMetrics {
  totalCompanies: number;
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  proCompanies: number;
  freeCompanies: number;
  mrr: number;
  totalRevenue: number;
  paidInvoicesCount: number;
}

type TabType = 'companies' | 'users' | 'invoices' | 'system';

export default function SuperAdminView() {
  const { data: session } = useSession();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Selected items
  const [inspectingCompany, setInspectingCompany] = useState<CompanyItem | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanyPlan, setEditCompanyPlan] = useState<'free' | 'pro'>('free');
  const [editCompanyStatus, setEditCompanyStatus] = useState<'active' | 'suspended'>('active');
  const [updatingCompany, setUpdatingCompany] = useState(false);

  // User edit modal
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [editUserRole, setEditUserRole] = useState('Member');
  const [editUserPlan, setEditUserPlan] = useState('free');
  const [editUserStatus, setEditUserStatus] = useState('active');
  const [updatingUser, setUpdatingUser] = useState(false);

  // Delete modal
  const [deletingCompany, setDeletingCompany] = useState<CompanyItem | null>(null);
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);
  const [deletingUser, setDeletingUser] = useState<PlatformUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Fetch all Super Admin platform data
  const loadPlatformData = async () => {
    setLoading(true);
    try {
      const [metricsRes, companiesRes, usersRes, invoicesRes] = await Promise.all([
        fetch('/api/admin/metrics', { cache: 'no-store' }),
        fetch('/api/admin/companies', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/invoices', { cache: 'no-store' }),
      ]);

      if (metricsRes.ok) {
        const json = await metricsRes.json();
        if (json.success) {
          setMetrics(json.data.metrics);
          setSystemStatus(json.data.systemStatus);
        }
      }

      if (companiesRes.ok) {
        const json = await companiesRes.json();
        if (json.success) {
          setCompanies(json.data);
        }
      }

      if (usersRes.ok) {
        const json = await usersRes.json();
        if (json.success) {
          setUsers(json.data);
        }
      }

      if (invoicesRes.ok) {
        const json = await invoicesRes.json();
        if (json.success) {
          setInvoices(json.data);
        }
      }
    } catch (err) {
      console.error('[SuperAdminView] Fetch error:', err);
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.owner?.name.toLowerCase().includes(q) ||
        c.owner?.email.toLowerCase().includes(q)
      );
    });
  }, [companies, searchQuery]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.team?.name.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.user.name.toLowerCase().includes(q) ||
        inv.user.email.toLowerCase().includes(q) ||
        inv.user.team?.name.toLowerCase().includes(q)
      );
    });
  }, [invoices, searchQuery]);

  // Handle company updates
  const handleSaveCompany = async () => {
    if (!editingCompany) return;
    setUpdatingCompany(true);
    try {
      const res = await fetch(`/api/admin/companies/${editingCompany.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCompanyName,
          plan: editCompanyPlan,
          status: editCompanyStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update company');
      }
      toast.success(json.message || 'Company updated successfully');
      setEditingCompany(null);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    } finally {
      setUpdatingCompany(false);
    }
  };

  // Handle company deletion
  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;
    setIsDeletingCompany(true);
    try {
      const res = await fetch(`/api/admin/companies/${deletingCompany.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to delete company');
      }
      toast.success(json.message || 'Company deleted');
      setDeletingCompany(null);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setIsDeletingCompany(false);
    }
  };

  // Handle user updates
  const handleSaveUser = async () => {
    if (!editingUser) return;
    setUpdatingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editUserRole,
          plan: editUserPlan,
          subscriptionStatus: editUserStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to update user');
      }
      toast.success(json.message || 'User updated successfully');
      setEditingUser(null);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err.message || 'User update failed');
    } finally {
      setUpdatingUser(false);
    }
  };

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to delete user');
      }
      toast.success(json.message || 'User deleted successfully');
      setDeletingUser(null);
      await loadPlatformData();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAFAFA] dark:bg-neutral-950 overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200/90 dark:border-neutral-800 px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                Platform Operations
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                FlowSync Headquarters
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadPlatformData}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={loading ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 21h5v-5" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Companies */}
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
              <span>Registered Companies</span>
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#2563EB]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 3l6 0" />
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {metrics ? metrics.totalCompanies : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {metrics?.proCompanies ?? 0} Pro
              </span>{' '}
              • {metrics?.freeCompanies ?? 0} Free
            </div>
          </div>

          {/* Monthly Recurring Revenue */}
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
              <span>Platform MRR</span>
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              ${metrics ? metrics.mrr.toFixed(2) : '0.00'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              Total Recorded Revenue: ${metrics ? metrics.totalRevenue.toFixed(2) : '0.00'}
            </div>
          </div>

          {/* Total Platform Users */}
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
              <span>Platform Users</span>
              <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {metrics ? metrics.totalUsers : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Active across all tenant workspaces</div>
          </div>

          {/* Total Projects & Tasks */}
          <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-medium mb-1.5">
              <span>Projects & Tasks</span>
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {metrics ? metrics.totalProjects : '...'}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">
              {metrics ? metrics.totalTasks : '...'} total tasks managed in system
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-neutral-200/90 dark:border-neutral-800 pb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('companies')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'companies'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
            >
              Registered Companies ({companies.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'users'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
            >
              Global Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'invoices'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
            >
              Billing & Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'system'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
            >
              System Health
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-64">
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-neutral-900 dark:text-white placeholder:text-neutral-400 shadow-2xs"
            />
          </div>
        </div>

        {/* ─── TAB 1: REGISTERED COMPANIES ─── */}
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {/* Companies Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Primary Admin / Owner</th>
                    <th className="py-3 px-4">Plan Tier</th>
                    <th className="py-3 px-4">Workspace Stats</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4 text-right">Super Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                  {filteredCompanies.map(company => (
                    <tr
                      key={company.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {company.name}
                          </span>
                          {company.isPlatformOwner && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Software Owner
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">{company.slug}</div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4">
                        {company.owner ? (
                          <div>
                            <div className="font-medium text-neutral-800 dark:text-neutral-200">
                              {company.owner.name}
                            </div>
                            <div className="text-[11px] text-neutral-400">{company.owner.email}</div>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">No admin assigned</span>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide ${company.plan === 'pro'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                            }`}
                        >
                          {company.plan}
                        </span>
                      </td>

                      {/* Stats */}
                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400">
                        <div>
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {company.membersCount}
                          </span>{' '}
                          members •{' '}
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {company.projectsCount}
                          </span>{' '}
                          projects
                        </div>
                        <div className="text-[11px] text-neutral-400">{company.tasksCount} tasks total</div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${company.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${company.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                              }`}
                          />
                          {company.status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-neutral-500 text-[11px]">
                        {new Date(company.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setInspectingCompany(company)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                            title="Inspect company members & projects"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => {
                              setEditingCompany(company);
                              setEditCompanyName(company.name);
                              setEditCompanyPlan(company.plan);
                              setEditCompanyStatus(company.status === 'suspended' ? 'suspended' : 'active');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Manage company tier and status"
                          >
                            Manage Tier
                          </button>
                          {!company.isPlatformOwner && (
                            <button
                              onClick={() => setDeletingCompany(company)}
                              className="px-2 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                              title="Delete company"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                        No companies found matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* ─── TAB 2: GLOBAL USERS ─── */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Company / Tenant</th>
                  <th className="py-3 px-4">Role Designation</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {filteredUsers.map(user => (
                  <tr
                    key={user.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[11px] shrink-0 overflow-hidden">
                          {user.avatar?.startsWith('http') || user.avatar?.startsWith('/') ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                          ) : (
                            (user.avatar && user.avatar.length <= 3 ? user.avatar : user.name.slice(0, 2)).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            {user.name}
                            {user.isSuperAdmin && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Super Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {user.team ? (
                        <div>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {user.team.name}
                          </span>
                          <div className="text-[10px] font-mono text-neutral-400">{user.team.slug}</div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">No Company</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${user.role === 'Super Admin'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : user.role === 'Admin'
                              ? 'bg-purple-500/10 text-purple-600'
                              : user.role === 'Project Manager'
                                ? 'bg-blue-500/10 text-blue-600'
                                : 'bg-emerald-500/10 text-emerald-600'
                          }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="py-3 px-4 uppercase text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                      {user.plan}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${user.subscriptionStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                          }`}
                      >
                        {user.subscriptionStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-neutral-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setEditUserRole(user.role);
                            setEditUserPlan(user.plan);
                            setEditUserStatus(user.subscriptionStatus);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          Edit User
                        </button>
                        {!user.isSuperAdmin && (
                          <button
                            onClick={() => setDeletingUser(user)}
                            className="px-2 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete user account"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 3: BILLING & INVOICES ─── */}
        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Issued Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {filteredInvoices.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-neutral-900 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-800 dark:text-neutral-200">
                      {inv.user?.team?.name || 'Customer Workspace'}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                      <div>{inv.user.name}</div>
                      <div className="text-[10px] text-neutral-400">{inv.user.email}</div>
                    </td>
                    <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white">
                      ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">{inv.planName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 capitalize">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-neutral-400">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                      No invoices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── TAB 4: SYSTEM HEALTH ─── */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Platform Architecture Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">Software Suite</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">FlowSync SaaS</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">Owner Organization</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">FlowSync</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">Primary Super Admin</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    Rasel Ahmed (rasel4897981@gmail.com)
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">Database Engine</span>
                  <span className="font-semibold text-emerald-600">Neon PostgreSQL (Connected)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">Multi-Tenant Scoping</span>
                  <span className="font-semibold text-emerald-600">Strict Isolation Enabled</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-neutral-400">Model Context Protocol (MCP)</span>
                  <span className="font-semibold text-blue-600">Active (Standard JSON-RPC 2.0)</span>
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Super Admin Capabilities
              </h3>
              <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-2 list-disc list-inside">
                <li>Complete visibility across all registered customer companies and workspaces.</li>
                <li>Instant tier management: upgrade or downgrade any company between Free and Pro.</li>
                <li>Company suspension / deactivation controls for safety and contract enforcement.</li>
                <li>Global user governance: promote users, adjust designations, or revoke access.</li>
                <li>Permanent protection of the primary FlowSync Super Admin account and headquarters.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: INSPECT COMPANY ─── */}
      {inspectingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 shrink-0">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                  Company Details: {inspectingCompany.name}
                </h3>
                <p className="text-xs text-neutral-400">Tenant Slug: {inspectingCompany.slug}</p>
              </div>
              <button
                onClick={() => setInspectingCompany(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-5 flex-1 pr-1">
              {/* Members Section */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Company Members ({inspectingCompany.members.length})
                </h4>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200/70 dark:border-neutral-800 rounded-xl overflow-hidden">
                  {inspectingCompany.members.map(m => (
                    <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-neutral-900 dark:text-white">{m.name}</div>
                        <div className="text-[11px] text-neutral-400">{m.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {m.role}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 uppercase">
                          {m.plan}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects Section */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                  Projects ({inspectingCompany.projects.length})
                </h4>
                {inspectingCompany.projects.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">No projects created yet.</p>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200/70 dark:border-neutral-800 rounded-xl overflow-hidden">
                    {inspectingCompany.projects.map(p => (
                      <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="font-medium text-neutral-900 dark:text-white">{p.name}</span>
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {p._count?.tasks ?? 0} tasks • Progress: {p.progress}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800 shrink-0">
              <button
                onClick={() => setInspectingCompany(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT COMPANY TIER / STATUS ─── */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Manage Company: {editingCompany.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-medium">Company Name</label>
                <input
                  type="text"
                  value={editCompanyName}
                  onChange={e => setEditCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-medium">Subscription Plan</label>
                <select
                  value={editCompanyPlan}
                  onChange={e => setEditCompanyPlan(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="free">Free Plan</option>
                  <option value="pro">Pro Plan ($20/mo)</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-medium">Account Status</label>
                <select
                  value={editCompanyStatus}
                  onChange={e => setEditCompanyStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="active">Active (Full Access)</option>
                  <option value="suspended">Suspended (Restricted)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setEditingCompany(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCompany}
                disabled={updatingCompany}
                className="px-4.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {updatingCompany ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: EDIT USER ─── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Edit User: {editingUser.name}
            </h3>
            <p className="text-xs text-neutral-400">{editingUser.email}</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-neutral-500 mb-1 font-medium">Role Designation</label>
                <select
                  value={editUserRole}
                  onChange={e => setEditUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="Super Admin">Super Admin (Platform Owner)</option>
                  <option value="Admin">Admin</option>
                  <option value="Project Manager">Project Manager</option>
                  <option value="Member">Member</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-medium">User Plan</label>
                <select
                  value={editUserPlan}
                  onChange={e => setEditUserPlan(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-500 mb-1 font-medium">Account Status</label>
                <select
                  value={editUserStatus}
                  onChange={e => setEditUserStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl outline-none focus:border-blue-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={updatingUser}
                className="px-4.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {updatingUser ? 'Updating...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE COMPANY ─── */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-red-600">Delete Company & Entire History?</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-neutral-900 dark:text-white">
                {deletingCompany.name}
              </span>
              ? This will completely purge the entire history of this company, including all projects, tasks, comments, activity logs, invoices, invitations, and member accounts from the entire platform. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingCompany(null)}
                disabled={isDeletingCompany}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCompany}
                disabled={isDeletingCompany}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {isDeletingCompany ? 'Deleting...' : 'Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DELETE USER ─── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200/90 dark:border-neutral-800 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-red-600">Delete User Account?</h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-neutral-900 dark:text-white">
                {deletingUser.name}
              </span>{' '}
              ({deletingUser.email})? All associated personal data, notifications, and invoices will be permanently removed. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                disabled={isDeletingUser}
                className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


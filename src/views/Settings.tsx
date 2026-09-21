import { useState } from 'react';
import { currentUser, users } from '../data/mockData';

type Section = 'profile' | 'workspace' | 'members' | 'notifications' | 'security' | 'billing' | 'integrations';

const navItems: { id: Section; label: string; group: string }[] = [
  { id: 'profile', label: 'Profile', group: 'Account' },
  { id: 'security', label: 'Security', group: 'Account' },
  { id: 'workspace', label: 'General', group: 'Workspace' },
  { id: 'members', label: 'Members', group: 'Workspace' },
  { id: 'notifications', label: 'Notifications', group: 'Workspace' },
  { id: 'integrations', label: 'Integrations', group: 'Integrations' },
  { id: 'billing', label: 'Billing & Plan', group: 'Billing' },
];

const groups = ['Account', 'Workspace', 'Integrations', 'Billing'];

const integrations = [
  { name: 'Slack', desc: 'Get task notifications in Slack channels', connected: true, icon: '#4A154B', letter: 'S' },
  { name: 'GitHub', desc: 'Link commits and PRs to tasks', connected: true, icon: '#111111', letter: 'G' },
  { name: 'Figma', desc: 'Attach design files to tasks', connected: false, icon: '#F24E1E', letter: 'F' },
  { name: 'Jira', desc: 'Sync with Jira projects', connected: false, icon: '#0052CC', letter: 'J' },
  { name: 'Google Drive', desc: 'Attach Drive files to tasks', connected: false, icon: '#0F9D58', letter: 'G' },
  { name: 'Zapier', desc: 'Automate workflows with 5,000+ apps', connected: false, icon: '#FF4A00', letter: 'Z' },
];

export default function Settings() {
  const [section, setSection] = useState<Section>('profile');

  return (
    <div className="flex-1 flex overflow-hidden bg-white">
      {/* Settings nav */}
      <div className="w-52 border-r border-[#E5E7EB] overflow-y-auto shrink-0 py-4 px-2">
        {groups.map(group => {
          const items = navItems.filter(i => i.group === group);
          return (
            <div key={group} className="mb-4">
              <div className="px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.35)]">{group}</div>
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
                    section === item.id ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[rgba(17,17,17,0.65)] hover:bg-[#F3F4F6] hover:text-[#111111]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {section === 'profile' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Profile</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Update your personal information</p>

            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#F3F4F6]">
              <div className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center text-[22px] font-bold text-white">{currentUser.avatar}</div>
              <div>
                <button className="px-3.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.7)] hover:bg-[#F9FAFB] transition-colors mr-2">Upload Photo</button>
                <button className="px-3.5 py-1.5 text-[13px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors">Remove</button>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Full Name', value: currentUser.name },
                { label: 'Work Email', value: currentUser.email, type: 'email' },
                { label: 'Job Title', value: currentUser.role },
                { label: 'Department', value: 'Engineering' },
              ].map(({ label, value, type }) => (
                <div key={label}>
                  <label className="block text-[12px] font-semibold text-[rgba(17,17,17,0.55)] mb-1.5">{label}</label>
                  <input
                    type={type ?? 'text'}
                    defaultValue={value}
                    className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-[13.5px] text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button className="px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        )}

        {section === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[20px] font-bold text-[#111111] mb-1">Members</h2>
                <p className="text-[13px] text-[rgba(17,17,17,0.45)]">{users.length} members in TaskFlow Inc.</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Invite Member
              </button>
            </div>
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[rgba(17,17,17,0.4)]">
                <span className="flex-1">Member</span>
                <span className="w-24">Role</span>
                <span className="w-20">Status</span>
                <span className="w-28">Last Active</span>
                <span className="w-16" />
              </div>
              {users.map((u, i) => (
                <div key={u.id} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#F9FAFB] transition-colors ${i < users.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-[11px] font-bold text-white">{u.avatar}</div>
                    <div>
                      <div className="text-[13.5px] font-medium text-[#111111]">{u.name} {u.id === currentUser.id && <span className="text-[10px] bg-[#DBEAFE] text-[#2563EB] px-1.5 py-0.5 rounded font-medium">You</span>}</div>
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.4)]">{u.email}</div>
                    </div>
                  </div>
                  <span className="w-24 text-[12.5px] text-[rgba(17,17,17,0.65)]">{i === 0 ? 'Owner' : i === 1 ? 'Admin' : 'Member'}</span>
                  <span className="w-20">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">Active</span>
                  </span>
                  <span className="w-28 text-[12px] text-[rgba(17,17,17,0.45)]">{['Just now', '5m ago', '1h ago', '2h ago', '3h ago', '1d ago'][i]}</span>
                  <div className="w-16 flex items-center gap-1">
                    <button className="text-[11.5px] text-[#2563EB] hover:underline">Edit</button>
                    {u.id !== currentUser.id && <span className="text-[rgba(17,17,17,0.2)]">·</span>}
                    {u.id !== currentUser.id && <button className="text-[11.5px] text-[#DC2626] hover:underline">Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'integrations' && (
          <div>
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Integrations</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Connect your tools with TaskFlow</p>
            <div className="grid grid-cols-2 gap-4">
              {integrations.map(integration => (
                <div key={integration.name} className="flex items-start gap-4 p-5 border border-[#E5E7EB] rounded-xl hover:border-[#93C5FD] transition-colors">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[16px] font-bold text-white shrink-0" style={{ backgroundColor: integration.icon }}>
                    {integration.letter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#111111]">{integration.name}</span>
                      {integration.connected && (
                        <span className="text-[10.5px] font-medium px-1.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">Connected</span>
                      )}
                    </div>
                    <p className="text-[12px] text-[rgba(17,17,17,0.5)] mt-0.5 mb-2.5">{integration.desc}</p>
                    <button className={`text-[12.5px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                      integration.connected
                        ? 'border border-[#E5E7EB] text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB]'
                        : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                    }`}>
                      {integration.connected ? 'Manage' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'billing' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Billing & Plan</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Manage your subscription</p>
            <div className="border border-[#2563EB] rounded-xl p-5 mb-6 bg-[#FAFBFF]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[14px] font-bold text-[#111111]">Pro Plan</span>
                  <span className="ml-2 text-[11px] bg-[#DBEAFE] text-[#2563EB] px-2 py-0.5 rounded font-semibold">Current</span>
                </div>
                <span className="text-[20px] font-bold text-[#111111]">$15<span className="text-[13px] font-normal text-[rgba(17,17,17,0.5)]">/mo per user</span></span>
              </div>
              <ul className="space-y-1.5 mb-4">
                {['Unlimited tasks & projects', 'Advanced reporting', 'Priority support', 'Custom fields', 'Team workload view'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-[12.5px] text-[rgba(17,17,17,0.7)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">Upgrade to Business</button>
                <button className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[rgba(17,17,17,0.6)] hover:bg-[#F9FAFB] transition-colors">Manage Billing</button>
              </div>
            </div>
            <div className="border border-[#E5E7EB] rounded-xl p-5">
              <h3 className="text-[14px] font-semibold text-[#111111] mb-3">Usage this month</h3>
              {[
                { label: 'Team Members', used: 6, limit: 10 },
                { label: 'Projects', used: 5, limit: 20 },
                { label: 'Storage', used: 2.4, limit: 10, unit: 'GB' },
              ].map(({ label, used, limit, unit }) => (
                <div key={label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-[12px] mb-1.5">
                    <span className="text-[rgba(17,17,17,0.65)]">{label}</span>
                    <span className="font-medium text-[#111111]">{used}{unit ?? ''} / {limit}{unit ?? ''}</span>
                  </div>
                  <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div className="h-full bg-[#2563EB] rounded-full" style={{ width: `${(used / limit) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Notifications</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Choose when and how you're notified</p>
            <div className="space-y-3">
              {[
                { label: 'Task assigned to me', desc: 'When a task is assigned to you' },
                { label: 'Task due soon', desc: '24 hours before a task is due' },
                { label: 'Comment on my task', desc: 'When someone comments on a task you own' },
                { label: 'Mentioned in comment', desc: 'When someone @mentions you' },
                { label: 'Task status changed', desc: 'When a task you follow changes status' },
                { label: 'New team member', desc: 'When someone joins your workspace' },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-center justify-between py-3.5 border-b border-[#F3F4F6]">
                  <div>
                    <div className="text-[13.5px] font-medium text-[#111111]">{label}</div>
                    <div className="text-[12px] text-[rgba(17,17,17,0.45)] mt-0.5">{desc}</div>
                  </div>
                  <button className="relative w-10 h-5 bg-[#2563EB] rounded-full transition-colors">
                    <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {section === 'security' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Security</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Manage your account security</p>
            <div className="space-y-4">
              <div className="border border-[#E5E7EB] rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-[#111111]">Two-Factor Authentication</div>
                    <div className="text-[12.5px] text-[rgba(17,17,17,0.5)] mt-0.5">Add an extra layer of security to your account</div>
                  </div>
                  <span className="text-[11.5px] font-medium px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#DC2626]">Not enabled</span>
                </div>
                <button className="mt-3 px-4 py-2 bg-[#2563EB] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1D4ED8] transition-colors">Enable 2FA</button>
              </div>
              <div className="border border-[#E5E7EB] rounded-xl p-5">
                <div className="text-[14px] font-semibold text-[#111111] mb-3">Active Sessions</div>
                {[
                  { device: 'Chrome on macOS', location: 'San Francisco, CA', time: 'Active now', current: true },
                  { device: 'Safari on iPhone', location: 'San Francisco, CA', time: '2 hours ago', current: false },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center justify-between py-3 ${i > 0 ? 'border-t border-[#F3F4F6]' : ''}`}>
                    <div>
                      <div className="text-[13px] font-medium text-[#111111] flex items-center gap-2">
                        {s.device}
                        {s.current && <span className="text-[10px] bg-[#F0FDF4] text-[#16A34A] px-1.5 py-0.5 rounded font-medium">Current</span>}
                      </div>
                      <div className="text-[11.5px] text-[rgba(17,17,17,0.45)] mt-0.5">{s.location} · {s.time}</div>
                    </div>
                    {!s.current && (
                      <button className="text-[12.5px] font-medium text-[#DC2626] hover:underline">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === 'workspace' && (
          <div className="max-w-xl">
            <h2 className="text-[20px] font-bold text-[#111111] mb-1">Workspace General</h2>
            <p className="text-[13px] text-[rgba(17,17,17,0.45)] mb-6">Manage your workspace settings</p>
            <div className="space-y-4">
              {[
                { label: 'Workspace Name', value: 'TaskFlow Inc.' },
                { label: 'Workspace URL', value: 'taskflow-inc.taskflow.io' },
                { label: 'Industry', value: 'Software / Technology' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="block text-[12px] font-semibold text-[rgba(17,17,17,0.55)] mb-1.5">{label}</label>
                  <input defaultValue={value} className="w-full px-3.5 py-2.5 border border-[#E5E7EB] rounded-lg text-[13.5px] text-[#111111] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] transition-all" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="px-5 py-2 bg-[#2563EB] text-white rounded-lg text-[13.5px] font-semibold hover:bg-[#1D4ED8] transition-colors">Save Changes</button>
            </div>
            <div className="mt-8 pt-6 border-t border-[#F3F4F6]">
              <div className="text-[14px] font-semibold text-[#DC2626] mb-2">Danger Zone</div>
              <div className="border border-[#FECACA] rounded-xl p-4">
                <div className="text-[13px] font-medium text-[#111111] mb-0.5">Delete Workspace</div>
                <div className="text-[12px] text-[rgba(17,17,17,0.5)] mb-3">This action is irreversible. All data will be permanently deleted.</div>
                <button className="px-4 py-1.5 border border-[#FECACA] rounded-lg text-[12.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">Delete Workspace</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

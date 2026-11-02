'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface IntegrationApp {
  name: string;
  category: 'AI & Copilots' | 'Developer Tools' | 'Communication' | 'Productivity';
  description: string;
  status: 'Live' | 'Instant Setup';
}

const ALL_INTEGRATIONS: IntegrationApp[] = [
  { name: 'Claude', category: 'AI & Copilots', description: 'Anthropic AI assistant integration for tasks, summaries & code reviews', status: 'Live' },
  { name: 'ChatGPT', category: 'AI & Copilots', description: 'OpenAI custom GPT and Model Context Protocol support', status: 'Live' },
  { name: 'Cursor IDE', category: 'AI & Copilots', description: 'Real-time task manipulation while authoring code', status: 'Live' },
  { name: 'GitHub', category: 'Developer Tools', description: 'Link pull requests, commits, and issues directly to tasks', status: 'Live' },
  { name: 'GitLab', category: 'Developer Tools', description: 'Sync merge requests and CI/CD pipelines', status: 'Live' },
  { name: 'Linear', category: 'Developer Tools', description: 'Bidirectional sync with team backlogs and cycles', status: 'Live' },
  { name: 'Slack', category: 'Communication', description: 'Daily standups, task creation from messages, and alerts', status: 'Live' },
  { name: 'Microsoft Teams', category: 'Communication', description: 'Collaborative task cards inside team chat channels', status: 'Live' },
  { name: 'Google Workspace', category: 'Productivity', description: 'Docs, Sheets, and Calendar integration for deadline tracking', status: 'Live' },
  { name: 'Google Chrome', category: 'Productivity', description: 'One-click task capture from any active browser tab', status: 'Live' },
  { name: 'Zapier', category: 'Productivity', description: 'Connect with 6,000+ business applications seamlessly', status: 'Live' },
  { name: 'Microsoft Outlook', category: 'Communication', description: 'Turn incoming client emails into tracked tasks', status: 'Live' },
  { name: 'Webhooks', category: 'Developer Tools', description: 'Real-time HTTP events for task creation and completion', status: 'Live' },
  { name: 'Figma', category: 'Productivity', description: 'Embed interactive design links and frame tasks', status: 'Live' },
  { name: 'Jira', category: 'Developer Tools', description: 'Import sprint boards and issue trackers in seconds', status: 'Live' },
];

export default function WireStackIntegrationsSection() {
  const [activeModal, setActiveModal] = useState<'integrations' | 'api' | 'mcp' | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [integrationFilter, setIntegrationFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const filteredIntegrations = ALL_INTEGRATIONS.filter(item => {
    const matchesCategory = integrationFilter === 'All' || item.category === integrationFilter;
    const matchesQuery =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <>
      <div className="section-content w-full h-full flex justify-center overflow-hidden">
        <div className="section-inner w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 md:pt-14 pb-[12vh] flex flex-col items-center">
          
          {/* Main Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#111111] dark:text-white leading-[1.18]">
              Wire your stack in, and through, FlowSync
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
              FlowSync works with the tools your team already uses. Now all your tasks are in one place.
            </p>
          </div>

          {/* 2-Column Split Cards Matching Reference Image */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 w-full max-w-5xl mx-auto items-stretch">
            
            {/* =========================================================================
                LEFT CARD: Create your perfect workflow
                ========================================================================= */}
            <div className="rounded-3xl border border-[#ECE5D8] dark:border-neutral-800 bg-[#FAF7F0] dark:bg-[#121316] p-6 sm:p-8 lg:p-9 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#111111] dark:text-white text-center mb-7 tracking-tight">
                  Create your perfect workflow
                </h3>

                {/* Staggered App Integration Badges Cluster */}
                <div className="flex flex-col items-center gap-3.5 sm:gap-4 my-2">
                  
                  {/* Row 1: Two Wide Hero Pills (Claude + ChatGPT) */}
                  <div className="flex items-center justify-center gap-3 sm:gap-3.5 flex-wrap">
                    {/* Claude Pill */}
                    <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/90 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
                      {/* Claude Starburst SVG */}
                      <svg viewBox="0 0 24 24" fill="#D97706" className="w-5 h-5 shrink-0">
                        <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
                        <path d="M18 16L19 19L22 20L19 21L18 24L17 21L14 20L17 19L18 16Z" fill="#D97706" opacity="0.8" />
                      </svg>
                      <span className="font-bold text-neutral-900 dark:text-white text-sm tracking-tight">
                        Claude
                      </span>
                    </div>

                    {/* ChatGPT Pill */}
                    <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/90 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default">
                      {/* ChatGPT Hexagonal Swirl SVG */}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-neutral-900 dark:text-white shrink-0">
                        <path d="M12 2a4 4 0 0 0-4 4v1.5a4 4 0 0 0-3 3.5v2a4 4 0 0 0 1.5 3.3A4 4 0 0 0 9 20h2a4 4 0 0 0 3.5-2v-1.5a4 4 0 0 0 3.5-3.5v-2A4 4 0 0 0 16 7h-2a4 4 0 0 0-2-5z" />
                      </svg>
                      <span className="font-bold text-neutral-900 dark:text-white text-sm tracking-tight">
                        ChatGPT
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Four Rounded App Square Badges */}
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
                    {/* Google Workspace */}
                    <div
                      title="Google Workspace"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <polygon points="8.5,3 15.5,3 21.5,13.5 14.5,13.5" fill="#FBBC05" />
                        <polygon points="14.5,13.5 21.5,13.5 18,19.5 4,19.5" fill="#34A853" />
                        <polygon points="8.5,3 12,9 5,21 1.5,15" fill="#4285F4" />
                      </svg>
                    </div>

                    {/* Microsoft Teams */}
                    <div
                      title="Microsoft Teams"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <rect x="2" y="5" width="14" height="14" rx="3" fill="#5059C9" />
                        <circle cx="18" cy="7" r="2.5" fill="#7B83EB" />
                        <rect x="15" y="11" width="7" height="8" rx="2" fill="#7B83EB" />
                        <text x="9" y="15" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">T</text>
                      </svg>
                    </div>

                    {/* Zapier */}
                    <div
                      title="Zapier"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <rect x="2" y="2" width="20" height="20" rx="5" fill="#FF4F00" />
                        <path d="M12 5v14M5 12h14M7 7l10 10M7 17L17 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Google Chrome */}
                    <div
                      title="Google Chrome"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <circle cx="12" cy="12" r="10" fill="#EA4335" />
                        <circle cx="12" cy="12" r="4.5" fill="white" />
                        <circle cx="12" cy="12" r="3.5" fill="#1A73E8" />
                        <path d="M12 2a10 10 0 0 1 8.66 5H12" fill="#EA4335" />
                        <path d="M20.66 7a10 10 0 0 1-5.32 14.33L12 12" fill="#FBBC05" />
                        <path d="M15.34 21.33A10 10 0 0 1 3.34 8.67L12 12" fill="#34A853" />
                      </svg>
                    </div>
                  </div>

                  {/* Row 3: Three Rounded App Square Badges */}
                  <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
                    {/* Slack */}
                    <div
                      title="Slack"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <path d="M6 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5z" fill="#E01E5A" />
                        <path d="M9 6a2 2 0 1 1 2-2v2H9zm0 1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h5z" fill="#36C5F0" />
                        <path d="M18 9a2 2 0 1 1 2 2h-2V9zm-1 0a2 2 0 1 1-4 0V4a2 2 0 1 1 4 0v5z" fill="#2EB67D" />
                        <path d="M15 18a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5z" fill="#ECB22E" />
                      </svg>
                    </div>

                    {/* Automations / Webhooks */}
                    <div
                      title="Automations & Webhooks"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <rect x="2" y="2" width="20" height="20" rx="5" fill="#FFF2EB" />
                        <circle cx="7" cy="9.5" r="2.2" fill="#FF6C37" />
                        <circle cx="17" cy="9.5" r="2.2" fill="#FF6C37" />
                        <circle cx="12" cy="16.5" r="2.2" fill="#FF6C37" />
                        <path d="M8.5 10.5l3.5 4.5 3.5-4.5" stroke="#FF6C37" strokeWidth="1.8" fill="none" />
                      </svg>
                    </div>

                    {/* Microsoft Outlook */}
                    <div
                      title="Microsoft Outlook"
                      className="w-13 h-13 sm:w-15 sm:h-15 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center cursor-default"
                    >
                      <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-7.5 sm:h-7.5">
                        <rect x="2" y="4" width="14" height="16" rx="2.5" fill="#0078D4" />
                        <rect x="10" y="6" width="12" height="12" rx="2" fill="#28A8EA" />
                        <circle cx="9" cy="12" r="3.5" fill="#004E8C" />
                        <text x="9" y="14.5" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">O</text>
                      </svg>
                    </div>
                  </div>

                </div>

                {/* Hand-drawn note & curved arrow */}
                <div className="relative mt-4 sm:mt-5 mb-1 flex flex-col items-center">
                  <div className="self-end pr-6 sm:pr-12 flex flex-col items-center">
                    <span className="text-xs sm:text-[13px] text-neutral-500 dark:text-neutral-400 font-serif italic tracking-wide">
                      ... and many more!
                    </span>
                    {/* Curved Hand-Drawn Arrow pointing down towards link */}
                    <svg width="42" height="30" viewBox="0 0 42 30" fill="none" className="text-neutral-400 dark:text-neutral-500 mt-0.5 transform -rotate-12">
                      <path d="M32 2C20 2 10 7 8 20M8 20L3 15M8 20L13 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bottom Centered Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setActiveModal('integrations')}
                  className="text-xs sm:text-sm font-semibold text-[#2563EB] dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Explore all integrations</span>
                  <span className="text-sm font-bold leading-none">&rsaquo;</span>
                </button>
              </div>
            </div>

            {/* =========================================================================
                RIGHT CARD: Connect via developer tools
                ========================================================================= */}
            <div className="rounded-3xl border border-[#ECE5D8] dark:border-neutral-800 bg-[#FAF7F0] dark:bg-[#121316] p-6 sm:p-8 lg:p-9 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#111111] dark:text-white text-center mb-6 tracking-tight">
                  Connect via developer tools
                </h3>

                <div className="space-y-4 sm:space-y-4.5 my-auto">
                  {/* 1. API Tool Card */}
                  <Link
                    href="/docs"
                    className="group bg-white dark:bg-neutral-800/90 rounded-2xl p-5 sm:p-6 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xs hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600 transition-all cursor-pointer flex items-start gap-4 block"
                  >
                    {/* API Squircle Icon Matching Image */}
                    <div className="w-12 h-12 rounded-2xl bg-[#111111] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 7l8-4 8 4-8 4-8-4z" />
                        <path d="M4 12l8 4 8-4" />
                        <path d="M4 17l8 4 8-4" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-[#111111] dark:text-white">
                        API
                      </h4>
                      <p className="text-xs sm:text-[13.5px] text-neutral-600 dark:text-neutral-400 mt-1 leading-snug font-normal">
                        Automate the routines only your business has, built straight on your team's tasks.
                      </p>
                      <div className="mt-2.5 text-xs sm:text-sm font-semibold text-[#2563EB] dark:text-blue-400 group-hover:underline inline-flex items-center gap-1">
                        <span>Read the API docs</span>
                        <span className="text-sm leading-none">&rsaquo;</span>
                      </div>
                    </div>
                  </Link>

                  {/* 2. MCP Server Tool Card */}
                  <div
                    onClick={() => setActiveModal('mcp')}
                    className="group bg-white dark:bg-neutral-800/90 rounded-2xl p-5 sm:p-6 border border-neutral-200/80 dark:border-neutral-700/80 shadow-2xs hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600 transition-all cursor-pointer flex items-start gap-4"
                  >
                    {/* MCP Server Squircle Icon Matching Image */}
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 18a4 4 0 0 1-4-4V8a4 4 0 0 1 8 0v8a4 4 0 0 1 8 0V8a4 4 0 0 1 4 4" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-bold text-[#111111] dark:text-white">
                        MCP server
                      </h4>
                      <p className="text-xs sm:text-[13.5px] text-neutral-600 dark:text-neutral-400 mt-1 leading-snug font-normal">
                        Let your AI agent work from the team's to-do list.
                      </p>
                      <div className="mt-2.5 text-xs sm:text-sm font-semibold text-[#2563EB] dark:text-blue-400 group-hover:underline inline-flex items-center gap-1">
                        <span>Set up the MCP server</span>
                        <span className="text-sm leading-none">&rsaquo;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


            </div>

          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE MODAL 1: EXPLORE ALL INTEGRATIONS
          ========================================================================= */}
      <Dialog open={activeModal === 'integrations'} onOpenChange={open => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <DialogTitle className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white">
              FlowSync Integrations Directory
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-neutral-500">
              Connect FlowSync with your favorite developer platforms, chat channels, and autonomous AI agents.
            </DialogDescription>

            {/* Search and Category Filter Toolbar */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {['All', 'AI & Copilots', 'Developer Tools', 'Communication', 'Productivity'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setIntegrationFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      integrationFilter === cat
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </DialogHeader>

          {/* Integrations Grid */}
          <div className="p-5 sm:p-6 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[45vh]">
            {filteredIntegrations.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{item.name}</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{item.description}</p>
                </div>
                <Link
                  href="/auth/login"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-neutral-700 transition-colors shrink-0"
                >
                  Connect
                </Link>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          INTERACTIVE MODAL 2: READ API DOCS
          ========================================================================= */}
      <Dialog open={activeModal === 'api'} onOpenChange={open => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-y-auto rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                API
              </span>
              <DialogTitle className="text-lg font-bold">FlowSync REST API (v1.0)</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-neutral-500">
              Create, query, and synchronize tasks and sprints programmatically.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-xs font-mono">
            {/* Create Task Code Box */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-neutral-200 p-4 relative">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-2 border-b border-neutral-800">
                <span className="font-semibold text-emerald-400">POST /api/tasks</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`curl -X POST https://flowsync.app/api/tasks \\\n  -H "Authorization: Bearer flw_sec_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"title": "Deploy API", "priority": "urgent"}'`, 'api-code')}
                  className="hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet === 'api-code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'api-code' ? 'Copied' : 'Copy cURL'}</span>
                </button>
              </div>
              <pre className="mt-3 text-[11px] leading-relaxed overflow-x-auto text-neutral-300">
{`curl -X POST https://flowsync.app/api/tasks \\
  -H "Authorization: Bearer flw_sec_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Fix auth webhook timeout",
    "priority": "urgent",
    "status": "todo",
    "dueDate": "2026-11-06"
  }'`}
              </pre>
            </div>

            {/* List Tasks Code Box */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-neutral-200 p-4 relative">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-2 border-b border-neutral-800">
                <span className="font-semibold text-blue-400">GET /api/tasks?limit=20</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`curl https://flowsync.app/api/tasks?limit=20 -H "Authorization: Bearer flw_sec_live_..."`, 'list-code')}
                  className="hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet === 'list-code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'list-code' ? 'Copied' : 'Copy cURL'}</span>
                </button>
              </div>
              <pre className="mt-3 text-[11px] leading-relaxed overflow-x-auto text-neutral-300">
{`curl https://flowsync.app/api/tasks?limit=20 \\
  -H "Authorization: Bearer flw_sec_live_..."`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* =========================================================================
          INTERACTIVE MODAL 4: SET UP THE MCP SERVER
          ========================================================================= */}
      <Dialog open={activeModal === 'mcp'} onOpenChange={open => !open && setActiveModal(null)}>
        <DialogContent className="max-w-xl p-6 rounded-2xl sm:rounded-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600/10 text-purple-600 font-bold text-xs flex items-center justify-center">
                MCP
              </div>
              <DialogTitle className="text-lg font-bold">Model Context Protocol (MCP) Server</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-neutral-500">
              Equip Claude Desktop, Cursor, and Windsurf with real-time FlowSync task tools.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 font-mono text-xs">
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans">
              Add this configuration to your <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">claude_desktop_config.json</code>:
            </div>

            <div className="rounded-xl bg-neutral-950 text-neutral-200 p-4 relative">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 pb-2 border-b border-neutral-800">
                <span>mcpServers config</span>
                <button
                  type="button"
                  onClick={() => handleCopy(`{\n  "mcpServers": {\n    "flowsync": {\n      "command": "npx",\n      "args": ["-y", "@flowsync/mcp-server"]\n    }\n  }\n}`, 'mcp-config')}
                  className="hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet === 'mcp-config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'mcp-config' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="mt-3 text-[11px] leading-relaxed overflow-x-auto text-neutral-300">
{`{
  "mcpServers": {
    "flowsync": {
      "command": "npx",
      "args": ["-y", "@flowsync/mcp-server"],
      "env": {
        "FLOWSYNC_API_KEY": "flw_sec_your_key_here"
      }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

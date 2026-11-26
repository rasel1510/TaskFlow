'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FlyingBirds from './FlyingBirds';

interface FooterProps {
  onOpenPWA?: () => void;
}

type FooterLink = { label: string; href?: string; onClick?: 'pwa' };

/*
 * Every link points to something that really exists in FlowSync:
 *   - landing page sections (#features, #integrations, #developer-platform, #faq)
 *   - app screens via /app?view=… (signed-out visitors sign in first, then land on that screen)
 *   - the developer documentation (/docs) and the install-app dialog
 * A support email is shown only when NEXT_PUBLIC_SUPPORT_EMAIL is configured.
 */
const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Install the app', onClick: 'pwa' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { label: 'Dashboard', href: '/app?view=dashboard' },
      { label: 'Projects', href: '/app?view=projects' },
      { label: 'My Tasks', href: '/app?view=tasks' },
      { label: 'Board', href: '/app?view=kanban' },
      { label: 'Calendar', href: '/app?view=calendar' },
      { label: 'Timeline', href: '/app?view=timeline' },
      { label: 'Reports', href: '/app?view=reports' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API documentation', href: '/docs' },
      { label: 'MCP server', href: '/docs' },
      { label: 'Developer platform', href: '/#developer-platform' },
    ],
  },
];

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || '';

const linkClass =
  'text-[13.5px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors duration-150 ease-out';

export default function Footer({ onOpenPWA }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="relative w-full bg-white dark:bg-[#0c0d0e] text-[#1f242e] dark:text-[#f0f2f5] pt-14 sm:pt-16 pb-0 transition-colors duration-200 font-sans overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-4 lg:pr-8">
            <Link aria-label="FlowSync home" href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 50 50" aria-hidden="true">
                  <path d="M27.5308 40.1395C27.5757 35.5502 26.4122 31.8182 24.9322 31.8037C23.4521 31.7893 22.2159 35.4979 22.1711 40.0871C22.1262 44.6764 23.2897 48.4085 24.7697 48.4229C26.2498 48.4374 27.486 44.7288 27.5308 40.1395Z" />
                  <path d="M18.947 39.0972C21.4661 35.2608 22.5052 31.4922 21.268 30.6798C20.0307 29.8674 16.9856 32.3188 14.4666 36.1552C11.9475 39.9916 10.9084 43.7601 12.1456 44.5726C13.3829 45.385 16.4279 42.9336 18.947 39.0972Z" />
                  <path d="M12.2792 33.593C16.4726 31.7278 19.3843 29.1194 18.7827 27.767C18.1812 26.4146 14.2942 26.8304 10.1008 28.6957C5.90744 30.5609 2.99571 33.1693 3.59726 34.5217C4.1988 35.8741 8.08584 35.4583 12.2792 33.593Z" />
                </svg>
              </span>
              <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">FlowSync</span>
            </Link>
            <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Projects, tasks, boards and reports for your team — in one simple workspace.
            </p>
            <div className="mt-5 flex items-center gap-4 text-[13.5px] font-medium">
              <Link href="/auth/login" className="text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150 ease-out">
                Sign in
              </Link>
              <span className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
              <Link href="/auth/signup" className="text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150 ease-out">
                Create free account
              </Link>
            </div>
          </div>

          {/* Link columns */}
          {COLUMNS.map(col => (
            <nav key={col.title} aria-label={col.title} className="lg:col-span-2 lg:first-of-type:col-start-7">
              <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    {link.onClick === 'pwa' ? (
                      <button type="button" onClick={onOpenPWA} className={`${linkClass} text-left cursor-pointer`}>
                        {link.label}
                      </button>
                    ) : (
                      <Link href={link.href!} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-neutral-100 dark:border-neutral-800/80 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-neutral-400 dark:text-neutral-500">© {year} FlowSync. All rights reserved.</p>
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[12.5px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors duration-150 ease-out">
              {SUPPORT_EMAIL}
            </a>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          SCENIC ALPINE CASTLE LANDSCAPE ARTWORK (High-Resolution Horizon)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden select-none pointer-events-none mt-4 sm:mt-6">
        {/* Soft atmospheric gradient fade to transition smoothly from the footer background */}
        <div className="absolute inset-x-0 top-0 h-16 sm:h-24 bg-gradient-to-b from-white dark:from-[#0c0d0e] via-white/50 dark:via-[#0c0d0e]/50 to-transparent z-10 pointer-events-none" />

        {/* Animated Flying Birds Layer Soaring Over the Horizon */}
        <FlyingBirds />

        {/* Light Mode: Ethereal high-resolution alpine mountain castle */}
        <div className="block dark:hidden w-full">
          <Image
            src="/footer-landscape-hd.png"
            alt="Scenic Alpine Castle Landscape Artwork"
            width={2048}
            height={940}
            className="w-full h-auto object-cover object-top max-h-[360px] sm:max-h-[440px] lg:max-h-[500px]"
            priority={false}
          />
        </div>

        {/* Dark Mode: Transparent alpine mountain castle with twilight atmospheric toning */}
        <div className="hidden dark:block w-full">
          <Image
            src="/footer-landscape-hd-transparent.png"
            alt="Scenic Alpine Castle Landscape Artwork"
            width={2048}
            height={940}
            className="w-full h-auto object-cover object-top max-h-[360px] sm:max-h-[440px] lg:max-h-[500px] opacity-90 brightness-95 contrast-105"
            priority={false}
          />
        </div>
      </div>
    </footer>
  );
}

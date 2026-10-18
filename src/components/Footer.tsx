'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Globe,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Check,
} from 'lucide-react';

interface FooterProps {
  onOpenPWA?: () => void;
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.77v8.37H6.46V10.9M7.85 6.46a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export default function Footer({ onOpenPWA }: FooterProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('English (US)');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English (US)' },
    { code: 'pt', label: 'Português' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
  ];

  return (
    <footer className="relative w-full bg-white dark:bg-[#0c0d0e] text-[#1f242e] dark:text-[#f0f2f5] pt-12 sm:pt-16 pb-0 transition-colors duration-200 font-sans overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        {/* ─────────────────────────────────────────────────────────────────────────
            NAVIGATION COLUMNS, CONTACT INFO, LANGUAGE & SOCIAL
            ───────────────────────────────────────────────────────────────────────── */}
        <div className="pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
          {/* Column 1: Company / Platform - 3 cols on lg */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">
              Company
            </h3>
            <ul className="flex flex-col space-y-3 text-[14px]">
              <li>
                <Link
                  href="#features"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  About TaskFlow
                </Link>
              </li>
              <li>
                <Link
                  href="#features"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Features & Workflows
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenPWA}
                  className="text-left text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Desktop & PWA App
                </button>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Security & Compliance
                </Link>
              </li>
              <li>
                <Link
                  href="#faq"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Support & FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Platform Views - 3 cols on lg */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">
              Platform Views
            </h3>
            <ul className="flex flex-col space-y-3 text-[14px]">
              <li>
                <Link
                  href="/app"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Workspace Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/app"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Kanban Boards
                </Link>
              </li>
              <li>
                <Link
                  href="/app"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Sprint Backlog
                </Link>
              </li>
              <li>
                <Link
                  href="/app"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Timeline & Gantt
                </Link>
              </li>
              <li>
                <Link
                  href="/app"
                  className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors"
                >
                  Calendar Scheduling
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Direct Contact with subtle outlined icon badges - 3 cols on lg */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-white">
              Direct Contact
            </h3>
            <ul className="flex flex-col space-y-3.5 text-[14px]">
              {/* Email item */}
              <li>
                <a
                  href="mailto:support@taskflow.dev"
                  className="group flex items-center gap-3 text-neutral-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-white transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-blue-600 dark:text-blue-400 transition-colors group-hover:border-blue-400 dark:group-hover:border-blue-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="text-[13.5px] tracking-tight">support@taskflow.dev</span>
                </a>
              </li>

              {/* Phone item */}
              <li>
                <a
                  href="tel:+15552348275"
                  className="group flex items-center gap-3 text-neutral-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-white transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-blue-600 dark:text-blue-400 transition-colors group-hover:border-blue-400 dark:group-hover:border-blue-500">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span className="text-[13.5px] tracking-tight">+1 (555) 234-TASK</span>
                </a>
              </li>

              {/* Location item */}
              <li>
                <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-blue-600 dark:text-blue-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <span className="text-[13.5px] tracking-tight">San Francisco, CA</span>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4: Language Selector & Social Icon Buttons - 3 cols on lg */}
          <div className="lg:col-span-3 flex flex-col items-start lg:items-end justify-between space-y-6 lg:h-full">
            {/* Language Selector Dropdown matching Image 2 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3.5 py-2 text-[13.5px] font-medium text-neutral-700 dark:text-neutral-200 shadow-2xs hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-haspopup="listbox"
                aria-expanded={isLangDropdownOpen}
              >
                <Globe className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                <span>{selectedLanguage}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${
                    isLangDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isLangDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-44 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-1.5 shadow-lg z-30 transition-all">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.label);
                        setIsLangDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-[13px] text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left cursor-pointer"
                    >
                      <span>{lang.label}</span>
                      {selectedLanguage === lang.label && (
                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Social Media Rounded Square Icon Buttons matching Image 2 */}
            <div className="flex items-center gap-2.5">
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs hover:scale-105"
              >
                <LinkedInIcon />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs hover:scale-105"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs hover:scale-105"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:border-neutral-400 dark:hover:border-neutral-600 transition-all shadow-2xs hover:scale-105"
              >
                <YouTubeIcon />
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          SCENIC ALPINE CASTLE LANDSCAPE ARTWORK (High-Resolution Horizon)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden select-none pointer-events-none mt-4 sm:mt-6">
        {/* Soft atmospheric gradient fade to transition smoothly from the footer background */}
        <div className="absolute inset-x-0 top-0 h-16 sm:h-24 bg-gradient-to-b from-white dark:from-[#0c0d0e] via-white/50 dark:via-[#0c0d0e]/50 to-transparent z-10 pointer-events-none" />

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

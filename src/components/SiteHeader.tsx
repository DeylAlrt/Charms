"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Top bar matching navilleracharms.vercel.app (Css_Folder/navbar.css there):
 * logo on the left, the site's page links across the middle on desktop, and
 * on phones a hamburger that slides in the same dark sidebar menu.
 */

const SITE = 'https://navilleracharms.vercel.app';
const LOGO = 'https://ik.imagekit.io/mpojoducq/Logo.png?tr=t-true,h-160';
const ICON = (name: string) => `https://img.icons8.com/material-outlined/24/b6b6b6/${name}.png`;

const LINKS = [
  { label: 'Home', href: `${SITE}/index.html`, icon: ICON('home--v1') },
  { label: 'About Us', href: `${SITE}/about-us.html`, icon: ICON('info--v1') },
  { label: 'Size Guide', href: `${SITE}/size-guide.html`, icon: ICON('ruler') },
  { label: 'FAQs', href: `${SITE}/FAQs.html`, icon: ICON('chat--v1') },
];

// Sidebar only (the site shows this one in its mobile menu, not the top bar)
const COLLECTION = { label: 'Charm Collection', href: `${SITE}/index.html#to-collections`, icon: ICON('star--v1') };

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  // Close with Escape, like the site
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="bg-navy-deep relative z-50 flex-shrink-0 h-[68px] sm:h-[76px] px-4 sm:px-8 flex items-center justify-between rounded-b-[25px] shadow-[0_10px_30px_rgba(15,42,79,0.3)]">
        <a href={`${SITE}/index.html`} aria-label="NavilleraCharms Home" className="flex items-center h-full py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="NavilleraCharms Logo" className="h-[44px] sm:h-[50px] w-auto transition-transform duration-200 hover:scale-105" draggable={false} />
        </a>

        {/* Desktop: page links in the middle */}
        <nav aria-label="Main navigation" className="hidden md:flex absolute left-1/2 -translate-x-1/2 gap-10">
          {LINKS.map(link => (
            <a key={link.label} href={link.href} className="group relative pb-1 text-white font-medium text-[0.95rem] transition-[color,translate] duration-200 hover:text-[#ffc6de] hover:-translate-y-0.5 focus-visible:text-[#ffc6de]">
              {link.label}
              <span aria-hidden className="absolute left-1/2 bottom-0 h-[2px] w-full -translate-x-1/2 scale-x-0 rounded-full bg-pink transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />
            </a>
          ))}
        </nav>

        {/* Phones: hamburger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="site-sidebar"
          className="md:hidden flex flex-col justify-center items-center gap-[5px] w-11 h-11 rounded-full transition-colors duration-200 hover:bg-[rgba(255,158,198,0.18)]"
        >
          <span className="block w-7 h-[3px] rounded-full bg-white" />
          <span className="block w-7 h-[3px] rounded-full bg-white" />
          <span className="block w-7 h-[3px] rounded-full bg-white" />
        </button>
      </header>

      {/* Dimmed background behind the open menu */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-[1900] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Slide-in sidebar, same look as the site's mobile menu */}
      <aside
        id="site-sidebar"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-[2000] h-dvh w-[300px] max-w-[85vw] flex flex-col bg-[rgba(7,18,40,0.98)] rounded-l-[24px] transition-transform duration-300 ease-in-out ${open ? 'translate-x-0 shadow-[-10px_0_40px_rgba(0,0,0,0.25)]' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Navillera Logo" className="h-[52px] w-auto" draggable={false} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile navigation links" className="flex flex-col gap-1 px-4 py-5">
          {/* Build Now — highlighted first item, like the site; this is the current page */}
          <Link
            href="/"
            aria-current="page"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-cream/10 text-cream font-semibold text-[0.95rem] transition-colors duration-200 hover:bg-cream/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://img.icons8.com/material-outlined/24/FCF5BE/sparkling.png" alt="" className="w-5 h-5" draggable={false} />
            Build Now
            <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-cream text-navy px-2 py-0.5 rounded-full">You&apos;re here</span>
          </Link>

          {[...LINKS, COLLECTION].map(link => (
            <a
              key={link.label}
              href={link.href}
              tabIndex={open ? 0 : -1}
              className="group flex items-center gap-4 px-4 py-3 rounded-xl text-[#d1d5db] font-semibold text-[0.95rem] transition-[color,background-color,translate] duration-200 hover:bg-white/10 hover:text-white hover:translate-x-1.5 focus-visible:bg-white/10 focus-visible:text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={link.icon} alt="" className="w-5 h-5 opacity-90 transition-transform duration-200 group-hover:scale-110" draggable={false} />
              {link.label}
            </a>
          ))}
        </nav>
      </aside>
    </>
  );
}

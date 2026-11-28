import React from 'react';
import { User } from 'firebase/auth';
import { motion, useScroll, useSpring } from 'motion/react';
import { UserProfile } from '../types/reclaim';

export type ActiveRoute = 'home' | 'search' | 'map' | 'claims' | 'admin';

interface HeaderProps {
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  firebaseUser: User | null;
  profile: UserProfile | null;
  unreadNotifications: number;
  onOpenAuthModal: () => void;
}

const NAV_ITEMS: { id: ActiveRoute; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'search', label: 'Search & Matches' },
  { id: 'map', label: '3D Campus' },
  { id: 'claims', label: 'Claims' },
  { id: 'admin', label: 'Admin' },
];

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  onNavigate,
  firebaseUser,
  profile,
  unreadNotifications,
  onOpenAuthModal,
}) => {
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 28,
    restDelta: 0.001,
  });

  const accountLabel = firebaseUser
    ? profile?.displayName?.split(' ')[0] || firebaseUser.displayName?.split(' ')[0] || 'Account'
    : 'Sign In';

  const isMapView = activeRoute === 'map';

  return (
    <header
      className={`sticky top-0 z-30 border-b border-slate-200/80 ${
        isMapView ? 'bg-white' : 'bg-white/92 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
          className="font-display text-xl font-extrabold tracking-tight text-[#0B1437] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#1A4BFF] rounded-sm transition-colors hover:text-[#1A4BFF]"
        >
          Re<span className="text-[#1A4BFF]">Claim</span>
        </a>

        {/* Zone 2: 5 concise single-line text nav links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeRoute === item.id;
            const showCount = item.id === 'claims' && unreadNotifications > 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative whitespace-nowrap shrink-0 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-[#1A4BFF] ${
                  isActive
                    ? 'text-[#1A4BFF] font-semibold'
                    : 'text-slate-600 hover:text-[#0B1437]'
                }`}
              >
                <span>{item.label}</span>
                {showCount && (
                  <span className="ml-1 font-mono text-xs font-semibold tabular-nums text-[#FF4D2E]">
                    ({unreadNotifications})
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="reclaim-nav-underline"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[21px] h-[2.5px] rounded-full bg-gradient-to-r from-[#1A4BFF] to-[#FF4D2E]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="whitespace-nowrap shrink-0 rounded-lg bg-[#1A4BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#1A4BFF]/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#143CD6] hover:shadow-md hover:shadow-[#1A4BFF]/30 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A4BFF]"
          >
            {accountLabel}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-1.5"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? 'bg-[#1A4BFF] text-white font-semibold' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Smooth Scroll Progress Indicator */}
      {!isMapView && (
        <motion.div
          aria-hidden="true"
          data-testid="scroll-progress-bar"
          style={{ scaleX: smoothProgress, transformOrigin: '0% 50%' }}
          className="h-[2.5px] w-full bg-gradient-to-r from-[#1A4BFF] via-[#0EA5A4] to-[#FF4D2E]"
        />
      )}
    </header>
  );
};

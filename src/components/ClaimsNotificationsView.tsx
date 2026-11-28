import React from 'react';
import { Bell, CheckCircle2, Clock, MailCheck, Search } from 'lucide-react';
import { OwnershipClaim, UserNotification } from '../types/reclaim';
import { ScrollReveal } from './ScrollReveal';

interface ClaimsNotificationsViewProps {
  claims: OwnershipClaim[];
  notifications: UserNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllRead: () => void;
  onBrowseMatches: () => void;
}

export const ClaimsNotificationsView: React.FC<ClaimsNotificationsViewProps> = ({
  claims,
  notifications,
  onMarkNotificationRead,
  onMarkAllRead,
  onBrowseMatches,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const statusMeta: Record<OwnershipClaim['status'], { label: string; tone: string }> = {
    pending: { label: 'Pending Admin Review', tone: 'text-[#D97706]' },
    approved: { label: 'Approved for Pickup', tone: 'text-[#1A4BFF]' },
    rejected: { label: 'Verification Declined', tone: 'text-[#FF4D2E]' },
    handed_over: { label: 'Returned & Handed Over', tone: 'text-[#059669]' },
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1437]">
            Ownership Claims &amp; Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track private verification reviews, match alerts, and campus desk handovers.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseMatches}
          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#1A4BFF] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#1A4BFF]/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#143CD6]"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Find Potential Matches</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Submitted Claims */}
        <section aria-labelledby="my-claims-heading" className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="my-claims-heading" className="text-base font-bold text-slate-900">
              Submitted Ownership Claims ({claims.length})
            </h2>
          </div>

          {claims.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <Clock className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">No ownership claims yet</h3>
              <p className="mt-1 text-xs text-slate-600">
                When you find a matching campus item, submit private verification details to initiate
                an administrator review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {claims.map((claim, idx) => {
                const st = statusMeta[claim.status];
                return (
                  <ScrollReveal key={claim.id} delay={idx * 0.06}>
                    <article className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-[#0B1437]">{claim.itemName}</h3>
                        <span className={`text-xs font-bold ${st.tone}`}>{st.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Claimant: {claim.claimantName} · Submitted {claim.createdAt.slice(0, 10)}
                        {typeof claim.matchScore === 'number'
                          ? ` · Suggested match ${claim.matchScore}%`
                          : ''}
                      </p>
                      <div className="mt-3 rounded-lg bg-[#F4F7FF] p-3 text-xs text-slate-700">
                        <p className="font-semibold text-[#0B1437]">Private Verification Submitted</p>
                        <p className="mt-1 leading-relaxed">{claim.verificationAnswer}</p>
                        {claim.uniqueMarks && (
                          <p className="mt-1 text-slate-500">Additional marks: {claim.uniqueMarks}</p>
                        )}
                      </div>
                      {claim.adminNotes && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#059669]">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Admin note: {claim.adminNotes}</span>
                        </p>
                      )}
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Notifications Feed */}
        <section aria-labelledby="notifications-heading" className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="notifications-heading" className="text-base font-bold text-slate-900">
              Notifications ({unreadCount} unread)
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="mt-2 text-xs text-slate-600">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 transition-colors ${n.read ? 'bg-white' : 'bg-blue-50/40'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.message}</p>
                      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-400">
                        {n.createdAt.slice(0, 10)} · {n.kind}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(n.id)}
                        className="whitespace-nowrap shrink-0 text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <MailCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
              <span>Email Notifications via Gmail</span>
            </div>
            <p className="mt-1.5 leading-relaxed">
              Administrators can send verified claim pickup instructions directly to students via
              Gmail from the Admin Console once Google Workspace is connected.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

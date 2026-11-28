import React from 'react';
import { ArrowRight, Compass, FileSearch, PlusCircle, Search, ShieldCheck } from 'lucide-react';
import { CampusItem, MatchResult } from '../types/reclaim';
import { ItemThumbnail } from './ItemThumbnail';
import { ScrollReveal } from './ScrollReveal';
import { TiltCard3D } from './TiltCard3D';

interface HomeViewProps {
  items: CampusItem[];
  matches: MatchResult[];
  onReportLost: () => void;
  onReportFound: () => void;
  onOpenSearch: () => void;
  onOpen3DMap: () => void;
  onSelectMatchForClaim: (match: MatchResult) => void;
  onSelectItemForClaim: (item: CampusItem) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  items,
  matches,
  onReportLost,
  onReportFound,
  onOpenSearch,
  onOpen3DMap,
  onSelectMatchForClaim,
  onSelectItemForClaim,
}) => {
  const lostCount = items.filter((i) => i.type === 'lost' && i.status !== 'archived').length;
  const foundCount = items.filter((i) => i.type === 'found' && i.status !== 'archived').length;
  const returnedCount = items.filter((i) => i.status === 'returned').length;
  const highMatches = matches.filter((m) => m.tier === 'high');

  const recentItems = [...items]
    .filter((i) => i.status !== 'archived')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      {/* Hero Section */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        <ScrollReveal immediate className="lg:col-span-7 flex">
          <TiltCard3D
            maxTilt={3.2}
            glareTone="dark"
            className="flex flex-1 flex-col justify-between rounded-2xl border border-[#1E3A8A]/60 bg-[#0B1437] p-8 text-white shadow-xl shadow-[#0B1437]/15"
          >
            {/* Atmospheric architectural lighting accents */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#1A4BFF]/35 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#FF4D2E]/22 blur-3xl"
            />

            <div className="relative z-10">
              <p className="text-xs font-semibold tracking-wide text-[#7DD3FC]">
                Centralized Campus Lost &amp; Found Management
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl leading-[1.15] [text-wrap:balance]">
                Reunite lost campus belongings through{' '}
                <span className="text-[#60A5FA]">intelligent text matching</span>.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">
                ReClaim compares detailed textual descriptions, synonyms, campus locations, and
                dates using TF-IDF and Jaccard similarity to surface high-confidence lost-and-found
                matches — even when no photographs are uploaded.
              </p>
            </div>

            <div className="relative z-10 mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onReportLost}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#FF4D2E] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#FF4D2E]/30 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#E6391C] hover:shadow-lg hover:shadow-[#FF4D2E]/35 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D2E]"
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                <span>Report Lost Item</span>
              </button>
              <button
                type="button"
                onClick={onReportFound}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#1A4BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#1A4BFF]/30 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#143CD6] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Report Found Item</span>
              </button>
              <button
                type="button"
                onClick={onOpenSearch}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/18 active:translate-y-0"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span>Search Items</span>
              </button>
            </div>
          </TiltCard3D>
        </ScrollReveal>

        {/* Right Highlight: Top Intelligent Text Match Preview */}
        <ScrollReveal immediate delay={0.08} className="lg:col-span-5 flex">
          <TiltCard3D
            maxTilt={3.2}
            glareTone="cobalt"
            className="flex flex-1 flex-col justify-between rounded-2xl border border-blue-200/80 bg-white p-6 shadow-md shadow-[#0B1437]/5"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-[#0B1437]">Top Suggested Text Matches</h2>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="text-xs font-semibold text-[#1A4BFF] hover:text-[#FF4D2E] transition-colors whitespace-nowrap shrink-0"
                >
                  View all matches
                </button>
              </div>

              {highMatches.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No high-potential matches detected yet. Submit a lost or found report to run live
                  text matching.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {highMatches.slice(0, 3).map((match) => (
                    <li key={match.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-bold text-[#0B1437] truncate">
                          {match.lostItem.itemName} ↔ {match.foundItem.itemName}
                        </p>
                        <span className="font-mono text-sm font-bold tabular-nums text-[#059669] shrink-0">
                          {match.finalScore}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#1A4BFF] to-[#10B981]"
                          style={{ width: `${match.finalScore}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {match.tierLabel} · {match.foundItem.location}
                        {match.breakdown.visualSimilarityScore !== null
                          ? ` · Visual support ${match.breakdown.visualSimilarityScore}%`
                          : ' · Text-only match'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500 truncate">
                          Shared terms: {match.breakdown.matchedKeywords.slice(0, 4).join(', ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectMatchForClaim(match)}
                          className="text-xs font-semibold text-[#1A4BFF] hover:text-[#FF4D2E] transition-colors whitespace-nowrap shrink-0"
                        >
                          Claim item →
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative z-10 mt-5 border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Explore live 3D hotspots across 6 buildings
              </span>
              <button
                type="button"
                onClick={onOpen3DMap}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1437] hover:text-[#1A4BFF] transition-colors whitespace-nowrap shrink-0"
              >
                <Compass className="h-3.5 w-3.5 text-[#FF4D2E]" aria-hidden="true" />
                <span>Open 3D Campus Map</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </TiltCard3D>
        </ScrollReveal>
      </section>

      {/* Full-Width 4-Column Live Statistics Strip */}
      <section aria-label="Campus recovery statistics">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: 'Active Lost Reports',
              value: lostCount,
              note: 'Indexed by text description',
              valueClass: 'text-[#FF4D2E]',
              barClass: 'from-[#FF4D2E] to-[#FB923C]',
              glare: 'coral' as const,
            },
            {
              label: 'Found Reports Logged',
              value: foundCount,
              note: 'Secured across campus desks',
              valueClass: 'text-[#1A4BFF]',
              barClass: 'from-[#1A4BFF] to-[#38BDF8]',
              glare: 'cobalt' as const,
            },
            {
              label: 'High Potential Matches',
              value: highMatches.length,
              note: 'TF-IDF & Jaccard ranked',
              valueClass: 'text-[#059669]',
              barClass: 'from-[#059669] to-[#34D399]',
              glare: 'emerald' as const,
            },
            {
              label: 'Successfully Returned',
              value: returnedCount,
              note: 'Admin-verified handovers',
              valueClass: 'text-[#D97706]',
              barClass: 'from-[#D97706] to-[#FBBF24]',
              glare: 'coral' as const,
            },
          ].map((stat, idx) => (
            <ScrollReveal key={stat.label} delay={idx * 0.06}>
              <TiltCard3D
                maxTilt={5}
                glareTone={stat.glare}
                className="rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-blue-200"
              >
                <div className={`h-1 w-full bg-gradient-to-r ${stat.barClass}`} />
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
                  <p className={`mt-1 font-mono text-3xl font-extrabold tabular-nums ${stat.valueClass}`}>
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
                </div>
              </TiltCard3D>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Recently Reported Items */}
      <section aria-labelledby="recent-reports-heading">
        <ScrollReveal>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <h2 id="recent-reports-heading" className="text-xl font-extrabold text-[#0B1437]">
                Recently Reported Campus Items
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Public summaries exclude private identifying marks to protect rightful owners.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenSearch}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1A4BFF] hover:text-[#FF4D2E] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Browse all {items.length} reports</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </ScrollReveal>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recentItems.map((item, idx) => {
            const bestMatch = matches.find(
              (m) => m.lostItem.id === item.id || m.foundItem.id === item.id
            );
            return (
              <ScrollReveal key={item.id} delay={(idx % 3) * 0.07} className="flex">
                <TiltCard3D
                  maxTilt={4}
                  glareTone={item.type === 'lost' ? 'coral' : 'cobalt'}
                  className="group flex flex-1 flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-lg hover:shadow-[#1A4BFF]/8"
                >
                  <ItemThumbnail
                    src={item.photoUrl}
                    alt={`${item.itemName} reported at ${item.location}`}
                    category={item.category}
                  />

                  <div className="relative z-10 mt-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`font-bold ${
                          item.type === 'lost' ? 'text-[#FF4D2E]' : 'text-[#1A4BFF]'
                        }`}
                      >
                        {item.type === 'lost' ? 'Lost Item' : 'Found Item'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{item.status}</span>
                    </div>

                    <h3 className="mt-1.5 text-base font-bold text-[#0B1437] transition-colors group-hover:text-[#1A4BFF]">
                      {item.itemName}
                    </h3>

                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="mt-auto pt-4 flex items-center justify-between gap-2 border-t border-slate-100 text-xs text-slate-500">
                      <span className="truncate">
                        {item.location} · {item.dateOccurred}
                      </span>
                      {bestMatch && bestMatch.tier !== 'low' ? (
                        <button
                          type="button"
                          onClick={() => onSelectMatchForClaim(bestMatch)}
                          className="font-mono font-bold tabular-nums text-[#059669] hover:text-[#1A4BFF] transition-colors whitespace-nowrap shrink-0"
                        >
                          {bestMatch.finalScore}% match
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectItemForClaim(item)}
                          className="font-semibold text-[#1A4BFF] hover:text-[#FF4D2E] transition-colors whitespace-nowrap shrink-0"
                        >
                          Submit claim
                        </button>
                      )}
                    </div>
                  </div>
                </TiltCard3D>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* How ReClaim Works */}
      <ScrollReveal>
        <section
          aria-labelledby="how-it-works-heading"
          className="rounded-2xl border border-blue-200/70 bg-white p-8 shadow-sm"
        >
          <div className="max-w-2xl">
            <h2 id="how-it-works-heading" className="text-xl font-extrabold text-[#0B1437]">
              How ReClaim Matches &amp; Verifies Items
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Designed for campus reliability: rich text comparison drives matching, optional photos
              provide supporting evidence, and administrators verify every handover.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="border-t-2 border-[#FF4D2E] pt-4">
              <p className="font-mono text-xs font-bold text-[#FF4D2E]">01</p>
              <h3 className="mt-1.5 text-base font-bold text-[#0B1437]">
                Detailed Textual Reporting
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Students describe lost or found items in natural language. Private identifying marks
                (like receipts inside a wallet or engraved initials) are stored separately and never
                shown publicly.
              </p>
            </div>
            <div className="border-t-2 border-[#1A4BFF] pt-4">
              <p className="font-mono text-xs font-bold text-[#1A4BFF]">02</p>
              <h3 className="mt-1.5 text-base font-bold text-[#0B1437]">
                Weighted Text Matching Engine
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                ReClaim tokenizes, normalizes synonyms, and scores Description (35%), Item Name
                (25%), Category (15%), Campus Location (15%), and Date Proximity (10%) via TF-IDF
                and Jaccard similarity.
              </p>
            </div>
            <div className="border-t-2 border-[#059669] pt-4">
              <p className="font-mono text-xs font-bold text-[#059669]">03</p>
              <h3 className="mt-1.5 text-base font-bold text-[#0B1437]">
                Admin-Verified Ownership Handover
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Matching scores only suggest candidates — never auto-confirm ownership. Claimants
                answer private verification questions reviewed by campus administrators before
                release.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <FileSearch className="h-4 w-4 text-[#1A4BFF] shrink-0" aria-hidden="true" />
            <span>
              Optional photograph uploads extract local visual histograms as secondary support,
              never overriding the primary text matching score.
            </span>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
};

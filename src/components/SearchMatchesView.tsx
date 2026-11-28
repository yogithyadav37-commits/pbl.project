import React, { useMemo, useState } from 'react';
import { Filter, Image as ImageIcon, PlusCircle, Search, SlidersHorizontal } from 'lucide-react';
import {
  CAMPUS_ZONES,
  CampusItem,
  CampusZoneId,
  ItemCategory,
  MatchResult,
  MatchingConfig,
} from '../types/reclaim';
import { ItemThumbnail } from './ItemThumbnail';
import { ScrollReveal } from './ScrollReveal';
import { TiltCard3D } from './TiltCard3D';
import { motion } from 'motion/react';

interface SearchMatchesViewProps {
  items: CampusItem[];
  matches: MatchResult[];
  categories: ItemCategory[];
  matchingConfig: MatchingConfig;
  initialZoneFilter: CampusZoneId | 'all';
  onClearZoneFilter: () => void;
  onSelectMatchForClaim: (match: MatchResult) => void;
  onSelectItemForClaim: (item: CampusItem) => void;
  onReportLost: () => void;
  onReportFound: () => void;
}

export const SearchMatchesView: React.FC<SearchMatchesViewProps> = ({
  items,
  matches,
  categories,
  matchingConfig,
  initialZoneFilter,
  onClearZoneFilter,
  onSelectMatchForClaim,
  onSelectItemForClaim,
  onReportLost,
  onReportFound,
}) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'reports'>('matches');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState<CampusZoneId | 'all'>(initialZoneFilter);
  const [typeFilter, setTypeFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'possible' | 'low'>('all');

  // Keep synced when navigating from 3D Campus Map with a specific zone selected
  React.useEffect(() => {
    setZoneFilter(initialZoneFilter);
    if (initialZoneFilter !== 'all') {
      setActiveTab('reports');
    }
  }, [initialZoneFilter]);

  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (tierFilter !== 'all' && m.tier !== tierFilter) return false;
      if (
        categoryFilter !== 'all' &&
        m.lostItem.category !== categoryFilter &&
        m.foundItem.category !== categoryFilter
      ) {
        return false;
      }
      if (
        zoneFilter !== 'all' &&
        m.lostItem.campusZone !== zoneFilter &&
        m.foundItem.campusZone !== zoneFilter
      ) {
        return false;
      }
      if (dateFilter && m.lostItem.dateOccurred !== dateFilter && m.foundItem.dateOccurred !== dateFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        m.lostItem.itemName,
        m.lostItem.description,
        m.lostItem.location,
        m.foundItem.itemName,
        m.foundItem.description,
        m.foundItem.location,
        m.breakdown.matchedKeywords.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [matches, searchQuery, categoryFilter, zoneFilter, dateFilter, tierFilter]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((i) => {
      if (i.status === 'archived') return false;
      if (typeFilter !== 'all' && i.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (zoneFilter !== 'all' && i.campusZone !== zoneFilter) return false;
      if (dateFilter && i.dateOccurred !== dateFilter) return false;
      if (!q) return true;
      const hay = `${i.itemName} ${i.description} ${i.location} ${i.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, searchQuery, typeFilter, categoryFilter, zoneFilter, dateFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setZoneFilter('all');
    setTypeFilter('all');
    setDateFilter('');
    setTierFilter('all');
    onClearZoneFilter();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Page Title & Mode Switch */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0B1437]">
            Search &amp; Intelligent Match Results
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Weighted text engine: Description {matchingConfig.descriptionWeight}% · Name{' '}
            {matchingConfig.nameWeight}% · Category {matchingConfig.categoryWeight}% · Location{' '}
            {matchingConfig.locationWeight}% · Date {matchingConfig.dateWeight}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-200/75 p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'matches'}
              onClick={() => setActiveTab('matches')}
              className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'matches'
                  ? 'bg-[#0B1437] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B1437]'
              }`}
            >
              Intelligent Matches ({filteredMatches.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reports'}
              onClick={() => setActiveTab('reports')}
              className={`whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'reports'
                  ? 'bg-[#0B1437] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B1437]'
              }`}
            >
              All Reports ({filteredItems.length})
            </button>
          </div>
          <button
            type="button"
            onClick={onReportLost}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#FF4D2E] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-[#FF4D2E]/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#E6391C]"
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Report Lost</span>
          </button>
          <button
            type="button"
            onClick={onReportFound}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#1A4BFF] px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-[#1A4BFF]/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#143CD6]"
          >
            <span>Report Found</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <section
        aria-label="Filter lost and found reports"
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label htmlFor="reclaim-search" className="block text-xs font-medium text-slate-600">
              Keyword or Description
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="reclaim-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., leather wallet, football sticker, cracked…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600">
              Category
            </label>
            <select
              id="filter-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All categories</option>
              {categories.filter((c) => c.active).map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-location" className="block text-xs font-medium text-slate-600">
              Campus Building
            </label>
            <select
              id="filter-location"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value as CampusZoneId | 'all')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All locations</option>
              {CAMPUS_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="filter-date" className="block text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              id="filter-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          {activeTab === 'matches' ? (
            <div>
              <label htmlFor="filter-tier" className="block text-xs font-medium text-slate-600">
                Match Tier
              </label>
              <select
                id="filter-tier"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All tiers</option>
                <option value="high">High potential (≥{matchingConfig.highThreshold}%)</option>
                <option value="possible">Possible (≥{matchingConfig.possibleThreshold}%)</option>
                <option value="low">Low similarity</option>
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="filter-type" className="block text-xs font-medium text-slate-600">
                Report Type
              </label>
              <select
                id="filter-type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">Lost &amp; Found</option>
                <option value="lost">Lost items only</option>
                <option value="found">Found items only</option>
              </select>
            </div>
          )}
        </div>

        {(searchQuery || categoryFilter !== 'all' || zoneFilter !== 'all' || dateFilter || tierFilter !== 'all' || typeFilter !== 'all') && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              Active filters applied
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-blue-700 hover:underline"
            >
              Reset all filters
            </button>
          </div>
        )}
      </section>

      {/* Tab 1: Intelligent Text Matching Suggestions */}
      {activeTab === 'matches' && (
        <section aria-label="Intelligent match suggestions" className="space-y-4">
          {filteredMatches.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <h2 className="mt-3 text-base font-bold text-slate-900">No matches for this filter</h2>
              <p className="mt-1 text-sm text-slate-600">
                Try clearing filters or submitting a detailed lost/found description to run new
                comparisons.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredMatches.map((match, idx) => {
              const tierColor =
                match.tier === 'high'
                  ? 'text-[#059669]'
                  : match.tier === 'possible'
                  ? 'text-[#D97706]'
                  : 'text-slate-500';

              const scoreBarGradient =
                match.tier === 'high'
                  ? 'from-[#1A4BFF] to-[#10B981]'
                  : match.tier === 'possible'
                  ? 'from-[#1A4BFF] to-[#F59E0B]'
                  : 'from-slate-400 to-slate-500';

              return (
                <ScrollReveal key={match.id} delay={Math.min(idx * 0.05, 0.25)}>
                  <article className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md">
                    {/* Match Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`font-bold ${tierColor}`}>{match.tierLabel}</span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="text-slate-500">
                            Primary Text Score:{' '}
                            <strong className="font-mono tabular-nums text-[#0B1437]">
                              {match.textScore}%
                            </strong>
                          </span>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <ImageIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                            {match.breakdown.visualSimilarityScore !== null
                              ? `Supporting Visual Similarity: ${match.breakdown.visualSimilarityScore}% (+${match.breakdown.visualBonusApplied} pts)`
                              : 'No photo pair (text-only matching)'}
                          </span>
                        </div>
                        <h2 className="mt-1 text-lg font-extrabold text-[#0B1437]">
                          {match.lostItem.itemName} ↔ {match.foundItem.itemName}
                        </h2>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[11px] font-medium text-slate-500">Final Score</p>
                          <p
                            className={`font-mono text-2xl font-extrabold tabular-nums ${
                              match.tier === 'high'
                                ? 'text-[#059669]'
                                : match.tier === 'possible'
                                ? 'text-[#1A4BFF]'
                                : 'text-slate-600'
                            }`}
                          >
                            {match.finalScore}%
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectMatchForClaim(match)}
                          className="whitespace-nowrap shrink-0 rounded-lg bg-[#1A4BFF] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#1A4BFF]/25 transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#143CD6]"
                        >
                          Submit Ownership Claim
                        </button>
                      </div>
                    </div>

                    {/* Side-by-Side Lost vs Found Comparison */}
                    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-[#FF4D2E]">
                          Lost Report · {match.lostItem.location} · {match.lostItem.dateOccurred}
                        </p>
                        <p className="text-sm font-bold text-[#0B1437]">{match.lostItem.itemName}</p>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {match.lostItem.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          Category: {match.lostItem.category} · Reported by {match.lostItem.reporterName}
                        </p>
                      </div>

                      <div className="space-y-1.5 lg:border-l lg:border-slate-100 lg:pl-5">
                        <p className="text-xs font-bold text-[#1A4BFF]">
                          Found Report · {match.foundItem.location} · {match.foundItem.dateOccurred}
                        </p>
                        <p className="text-sm font-bold text-[#0B1437]">{match.foundItem.itemName}</p>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {match.foundItem.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          Category: {match.foundItem.category} · Logged by {match.foundItem.reporterName}
                        </p>
                      </div>
                    </div>

                    {/* Weighted Breakdown Table */}
                    <div className="mt-4 border-t border-slate-100 pt-3.5">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {[
                          { label: 'Description', score: match.breakdown.descriptionScore, weight: matchingConfig.descriptionWeight },
                          { label: 'Item Name', score: match.breakdown.nameScore, weight: matchingConfig.nameWeight },
                          { label: 'Category', score: match.breakdown.categoryScore, weight: matchingConfig.categoryWeight },
                          { label: 'Location', score: match.breakdown.locationScore, weight: matchingConfig.locationWeight },
                          { label: 'Date', score: match.breakdown.dateScore, weight: matchingConfig.dateWeight },
                        ].map((metric) => (
                          <div key={metric.label}>
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-slate-600">
                                {metric.label} ({metric.weight}%)
                              </span>
                              <span className="font-mono font-bold tabular-nums text-[#0B1437]">
                                {metric.score}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                style={{
                                  width: `${metric.score}%`,
                                  transformOrigin: '0% 50%',
                                }}
                                className={`h-full rounded-full bg-gradient-to-r ${scoreBarGradient}`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          TF-IDF Cosine:{' '}
                          <strong className="font-mono tabular-nums text-[#0B1437]">
                            {match.breakdown.tfidfCosineScore}%
                          </strong>{' '}
                          · Jaccard:{' '}
                          <strong className="font-mono tabular-nums text-[#0B1437]">
                            {match.breakdown.jaccardScore}%
                          </strong>
                        </span>
                        {match.breakdown.matchedKeywords.length > 0 && (
                          <span>
                            Matched concepts:{' '}
                            <span className="font-mono font-medium text-[#1A4BFF]">
                              {match.breakdown.matchedKeywords.join(', ')}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })
          )}
        </section>
      )}

      {/* Tab 2: All Campus Reports Grid */}
      {activeTab === 'reports' && (
        <section aria-label="All campus lost and found items">
          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <h2 className="text-base font-bold text-slate-900">No campus reports match your search</h2>
              <p className="mt-1 text-sm text-slate-600">
                Try broadening your keywords or resetting location and category filters.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item, idx) => {
                const topMatch = matches.find(
                  (m) => m.lostItem.id === item.id || m.foundItem.id === item.id
                );
                return (
                  <ScrollReveal key={item.id} delay={(idx % 3) * 0.06} className="flex">
                    <TiltCard3D
                      maxTilt={4}
                      glareTone={item.type === 'lost' ? 'coral' : 'cobalt'}
                      className="group flex flex-1 flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-lg"
                    >
                      <ItemThumbnail
                        src={item.photoUrl}
                        alt={`${item.itemName} at ${item.location}`}
                        category={item.category}
                      />
                      <div className="relative z-10 mt-4 flex-1 flex flex-col">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-bold ${
                              item.type === 'lost' ? 'text-[#FF4D2E]' : 'text-[#1A4BFF]'
                            }`}
                          >
                            {item.type === 'lost' ? 'Lost' : 'Found'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{item.status}</span>
                        </div>

                        <h2 className="mt-1.5 text-base font-bold text-[#0B1437] group-hover:text-[#1A4BFF] transition-colors">
                          {item.itemName}
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                          {item.description}
                        </p>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500 truncate">
                            {item.location} · {item.dateOccurred}
                          </span>
                          {topMatch && topMatch.tier !== 'low' ? (
                            <button
                              type="button"
                              onClick={() => onSelectMatchForClaim(topMatch)}
                              className="font-mono font-bold tabular-nums text-[#059669] hover:text-[#1A4BFF] whitespace-nowrap shrink-0"
                            >
                              {topMatch.finalScore}% match
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectItemForClaim(item)}
                              className="font-semibold text-[#1A4BFF] hover:text-[#FF4D2E] whitespace-nowrap shrink-0"
                            >
                              Claim / Verify
                            </button>
                          )}
                        </div>
                      </div>
                    </TiltCard3D>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

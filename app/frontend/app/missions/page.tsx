'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Wallet,
  Trophy,
  Zap,
  Clock,
  XCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MissionStatus = 'open' | 'in-progress' | 'completed' | 'cancelled';
type MissionCategory = 'development' | 'design' | 'research' | 'marketing' | 'other';
type SortOption = 'newest' | 'reward-high' | 'reward-low';

interface Mission {
  id: number;
  title: string;
  description: string;
  reward: number;
  status: MissionStatus;
  category: MissionCategory;
  deadline: string;
  createdAt: string;
  tags: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_MISSIONS: Mission[] = [
  { id: 1, title: 'Build REST API for User Auth', description: 'Design and implement a secure authentication API using JWT tokens and refresh token rotation.', reward: 850, status: 'open', category: 'development', deadline: '2024-08-01', createdAt: '2024-06-20', tags: ['Rust', 'API', 'Security'] },
  { id: 2, title: 'Redesign Onboarding Flow', description: 'Improve the onboarding experience for new contributors with clear steps and progress tracking.', reward: 600, status: 'open', category: 'design', deadline: '2024-07-25', createdAt: '2024-06-18', tags: ['Figma', 'UX', 'Research'] },
  { id: 3, title: 'Smart Contract Audit', description: 'Perform a comprehensive security audit of the payment smart contracts on Stellar.', reward: 1200, status: 'in-progress', category: 'development', deadline: '2024-07-30', createdAt: '2024-06-15', tags: ['Soroban', 'Security', 'Stellar'] },
  { id: 4, title: 'Write Technical Documentation', description: 'Document all public APIs and write a getting started guide for new developers.', reward: 300, status: 'open', category: 'research', deadline: '2024-07-20', createdAt: '2024-06-14', tags: ['Docs', 'Writing', 'API'] },
  { id: 5, title: 'Community Growth Strategy', description: 'Develop a strategy to grow the contributor community by 50% in Q3.', reward: 450, status: 'open', category: 'marketing', deadline: '2024-08-10', createdAt: '2024-06-12', tags: ['Growth', 'Community', 'Strategy'] },
  { id: 6, title: 'Performance Optimization', description: 'Profile and optimize the frontend bundle size and load time by at least 40%.', reward: 700, status: 'completed', category: 'development', deadline: '2024-06-10', createdAt: '2024-05-20', tags: ['Next.js', 'Performance', 'Webpack'] },
  { id: 7, title: 'Mobile Responsive Fixes', description: 'Fix layout issues across mobile breakpoints and improve touch interactions.', reward: 400, status: 'open', category: 'design', deadline: '2024-07-18', createdAt: '2024-06-10', tags: ['CSS', 'Mobile', 'Tailwind'] },
  { id: 8, title: 'Competitor Analysis Report', description: 'Analyze top 5 competitors and identify feature gaps and opportunities.', reward: 250, status: 'open', category: 'research', deadline: '2024-07-22', createdAt: '2024-06-08', tags: ['Research', 'Analysis'] },
  { id: 9, title: 'Integrate Payment Gateway', description: 'Integrate Stripe payment gateway with webhook support and error handling.', reward: 950, status: 'in-progress', category: 'development', deadline: '2024-07-28', createdAt: '2024-06-05', tags: ['Stripe', 'Payments', 'TypeScript'] },
  { id: 10, title: 'Email Marketing Campaign', description: 'Design and execute an email campaign to re-engage inactive contributors.', reward: 350, status: 'cancelled', category: 'marketing', deadline: '2024-06-30', createdAt: '2024-06-01', tags: ['Email', 'Marketing'] },
  { id: 11, title: 'Database Schema Migration', description: 'Migrate existing PostgreSQL schema to support multi-tenancy with zero downtime.', reward: 1100, status: 'open', category: 'development', deadline: '2024-08-05', createdAt: '2024-05-30', tags: ['PostgreSQL', 'Migration', 'Backend'] },
  { id: 12, title: 'Accessibility Compliance Audit', description: 'Audit the platform against WCAG 2.1 AA standards and fix all critical issues.', reward: 500, status: 'open', category: 'design', deadline: '2024-07-31', createdAt: '2024-05-28', tags: ['A11y', 'WCAG', 'HTML'] },
];

const ITEMS_PER_PAGE = 6;

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<MissionStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  'in-progress': { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
};

const categoryConfig: Record<MissionCategory, { label: string; icon: string }> = {
  development: { label: 'Development', icon: '⚙️' },
  design: { label: 'Design', icon: '🎨' },
  research: { label: 'Research', icon: '🔍' },
  marketing: { label: 'Marketing', icon: '📣' },
  other: { label: 'Other', icon: '📌' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const status = statusConfig[mission.status];
  const category = categoryConfig[mission.category];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{category.icon}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{category.label}</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {mission.title}
          </h3>
        </div>
        <span className={`shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
        {mission.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {mission.tags.map((tag) => (
          <span key={tag} className="inline-flex px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700 mt-auto">
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{mission.deadline}</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-gray-900 dark:text-white text-sm">${mission.reward}</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
        <Zap className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No missions found</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        {hasFilters
          ? 'No missions match your current filters. Try adjusting your search or filters.'
          : 'There are no missions available right now. Check back soon.'}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
        We couldn&apos;t load missions. Please check your connection and try again.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function WalletNotConnected() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
      <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Wallet not connected</p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Connect your wallet to apply for missions and track your rewards.
        </p>
      </div>
      <button className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors">
        Connect
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [walletConnected] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MissionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<MissionCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const fetchMissions = () => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      setMissions(MOCK_MISSIONS);
      setIsLoading(false);
    }, 1200);
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, categoryFilter, sortBy]);

  const filtered = useMemo(() => {
    let result = [...missions];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') result = result.filter((m) => m.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter((m) => m.category === categoryFilter);

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'reward-high') return b.reward - a.reward;
      if (sortBy === 'reward-low') return a.reward - b.reward;
      return 0;
    });

    return result;
  }, [missions, search, statusFilter, categoryFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const hasFilters = search !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  const activeFilterCount = [search !== '', statusFilter !== 'all', categoryFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mission Marketplace</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Discover and apply for missions to earn rewards</p>
        </div>

        {/* Wallet banner */}
        {!walletConnected && <WalletNotConnected />}

        {/* Search + Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search missions, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <XCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="newest">Newest</option>
              <option value="reward-high">Reward: High → Low</option>
              <option value="reward-low">Reward: Low → High</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border rounded-lg transition-all ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-xs bg-white text-blue-600 rounded-full font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'open', 'in-progress', 'completed', 'cancelled'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                      statusFilter === s
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                    }`}
                  >
                    {s === 'all' ? 'All' : statusConfig[s].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'development', 'design', 'research', 'marketing', 'other'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                      categoryFilter === c
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                    }`}
                  >
                    {c === 'all' ? 'All' : `${categoryConfig[c].icon} ${categoryConfig[c].label}`}
                  </button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <div className="flex items-end ml-auto">
                <button onClick={resetFilters} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors">
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results count */}
        {!isLoading && !isError && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {filtered.length === 0
              ? 'No missions found'
              : `Showing ${(currentPage - 1) * ITEMS_PER_PAGE + 1}–${Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of ${filtered.length} mission${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}

        {/* Mission Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : isError ? (
            <ErrorState onRetry={fetchMissions} />
          ) : paginated.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onReset={resetFilters} />
          ) : (
            paginated.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </div>

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <div className="flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                const isActive = page === currentPage;
                const isNear = Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;

                if (!isNear) {
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={page} className="px-2 py-2 text-gray-400 text-sm">…</span>;
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

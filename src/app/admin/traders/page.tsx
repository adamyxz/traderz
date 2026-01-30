'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import {
  Plus,
  Search,
  SortAsc,
  ChevronDown,
  X,
  Sparkles,
  CheckSquare,
  Square,
  Trash2,
} from 'lucide-react';
import CreateTraderModal from './create-trader-modal';
import EditTraderModal from './edit-trader-modal';
import AiGenerateModal from './ai-generate-modal';
import TraderCard from './trader-card';
import type { Trader } from '@/db/schema';

interface TradingPair {
  id: number;
  symbol: string;
}

interface KlineInterval {
  id: number;
  code: string;
  label: string;
}

interface Reader {
  id: number;
  name: string;
  description: string | null;
}

interface TraderWithRelations extends Trader {
  preferredTradingPair?: TradingPair;
  preferredKlineIntervals?: KlineInterval[];
  readers?: Reader[];
}

type SortField =
  | 'name'
  | 'createdAt'
  | 'aggressivenessLevel'
  | 'maxPositions'
  | 'riskPreferenceScore';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'enabled' | 'paused' | 'disabled' | 'active' | 'inactive';

// Helper function to check if trader is currently active based on UTC time
const isTraderActive = (activeTimeStart: string, activeTimeEnd: string): boolean => {
  const now = new Date();
  const currentUTCHours = now.getUTCHours();
  const currentUTCMinutes = now.getUTCMinutes();
  const currentTimeInMinutes = currentUTCHours * 60 + currentUTCMinutes;

  const [startHours, startMinutes] = activeTimeStart.split(':').map(Number);
  const [endHours, endMinutes] = activeTimeEnd.split(':').map(Number);
  const startTimeInMinutes = startHours * 60 + startMinutes;
  const endTimeInMinutes = endHours * 60 + endMinutes;

  // Handle case where time range crosses midnight
  if (endTimeInMinutes < startTimeInMinutes) {
    return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
  }

  return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
};

export default function TradersAdminPage() {
  const router = useRouter();
  const [traders, setTraders] = useState<TraderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiGenerateModalOpen, setIsAiGenerateModalOpen] = useState(false);
  const [editingTrader, setEditingTrader] = useState<Trader | null>(null);
  const [deletingTraderId, setDeletingTraderId] = useState<number | null>(null);
  const [selectedTraderIds, setSelectedTraderIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Fetch traders from API
  useEffect(() => {
    isMounted.current = true;
    fetchTraders();

    // Cleanup function to clear refresh interval and mark as unmounted
    return () => {
      isMounted.current = false;
      const interval = (
        window as Window & { traderRefreshInterval?: ReturnType<typeof setInterval> }
      ).traderRefreshInterval;
      if (interval) {
        clearInterval(interval);
        delete (window as Window & { traderRefreshInterval?: ReturnType<typeof setInterval> })
          .traderRefreshInterval;
      }
    };
  }, []);

  const fetchTraders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/traders');
      if (!response.ok) throw new Error('Failed to fetch traders');
      const data = await response.json();
      // Only update state if component is still mounted
      if (isMounted.current) {
        setTraders(data);
      }
    } catch (error) {
      console.error('Error fetching traders:', error);
    } finally {
      // Only update loading state if component is still mounted
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Filter traders
  const filteredTraders = useMemo(() => {
    return traders.filter((trader) => {
      const matchesSearch =
        trader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trader.description &&
          trader.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = isTraderActive(trader.activeTimeStart, trader.activeTimeEnd);
      } else if (statusFilter === 'inactive') {
        matchesStatus = !isTraderActive(trader.activeTimeStart, trader.activeTimeEnd);
      } else if (statusFilter !== 'all') {
        matchesStatus = trader.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [traders, searchQuery, statusFilter]);

  // Sort traders
  const sortedTraders = useMemo(() => {
    return [...filteredTraders].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTraders, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedTraders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTraders = sortedTraders.slice(startIndex, startIndex + itemsPerPage);

  // CRUD operations
  const handleCreateTrader = async (
    newTrader: Partial<Trader> & {
      preferredTradingPairId?: number | null;
      preferredKlineIntervalIds?: number[];
    }
  ) => {
    try {
      const response = await fetch('/api/traders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrader),
      });

      if (!response.ok) throw new Error('Failed to create trader');

      const created: TraderWithRelations = await response.json();
      if (isMounted.current) {
        setTraders([created, ...traders]);
        setIsCreateModalOpen(false);
      }
    } catch (error) {
      console.error('Error creating trader:', error);
      if (isMounted.current) {
        alert('Creation failed, please try again');
      }
    }
  };

  const handleUpdateTrader = async (updatedTrader: TraderWithRelations) => {
    try {
      const response = await fetch(`/api/traders/${updatedTrader.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTrader),
      });

      if (!response.ok) throw new Error('Failed to update trader');

      const updated = await response.json();
      if (isMounted.current) {
        setTraders(traders.map((t) => (t.id === updated.id ? updated : t)));
        setEditingTrader(null);
      }
    } catch (error) {
      console.error('Error updating trader:', error);
      if (isMounted.current) {
        alert('Update failed, please try again');
      }
    }
  };

  const handleDeleteTrader = async (id: number) => {
    try {
      const response = await fetch(`/api/traders/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete trader');

      if (isMounted.current) {
        setTraders(traders.filter((t) => t.id !== id));
        setDeletingTraderId(null);
      }
    } catch (error) {
      console.error('Error deleting trader:', error);
      if (isMounted.current) {
        alert('Deletion failed, please try again');
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTraderIds.size === 0) return;

    try {
      setIsBatchDeleting(true);
      const response = await fetch('/api/traders/batch-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedTraderIds) }),
      });

      if (!response.ok) throw new Error('Failed to batch delete traders');

      if (isMounted.current) {
        setTraders(traders.filter((t) => !selectedTraderIds.has(t.id)));
        setSelectedTraderIds(new Set());
      }
    } catch (error) {
      console.error('Error batch deleting traders:', error);
      if (isMounted.current) {
        alert('Batch deletion failed, please try again');
      }
    } finally {
      if (isMounted.current) {
        setIsBatchDeleting(false);
      }
    }
  };

  const toggleTraderSelection = (traderId: number) => {
    setSelectedTraderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(traderId)) {
        newSet.delete(traderId);
      } else {
        newSet.add(traderId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedTraderIds(new Set());
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleViewPositions = (traderId: number) => {
    router.push(`/admin/positions?traderId=${traderId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
        <AdminSidebar />
        <div className="ml-20">
          <AdminHeader />
          <main className="flex items-center justify-center p-8">
            <div className="text-white">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
      <AdminSidebar />
      <div className="ml-20">
        <AdminHeader />

        <main className="p-8">
          {/* Header with Title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Trader Management</h1>
          </div>

          {/* Filters and Search */}
          <div className="mb-6 rounded-2xl p-6" style={{ backgroundColor: '#2D2D2D' }}>
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search trader name or description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg bg-gray-700/50 py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StatusFilter);
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-lg bg-gray-700/50 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Now</option>
                  <option value="inactive">Inactive Now</option>
                  <option value="enabled">Enabled</option>
                  <option value="paused">Paused</option>
                  <option value="disabled">Disabled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Items Per Page */}
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none rounded-lg bg-gray-700/50 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="12">12 / page</option>
                  <option value="20">20 / page</option>
                  <option value="48">48 / page</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Controls Row: Select All, Sort, and Action Buttons */}
          <div
            className="mb-6 rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{ backgroundColor: '#2D2D2D' }}
          >
            {/* Select All Control */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (selectedTraderIds.size === paginatedTraders.length) {
                    setSelectedTraderIds(new Set());
                  } else {
                    setSelectedTraderIds(new Set(paginatedTraders.map((t) => t.id)));
                  }
                }}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                disabled={paginatedTraders.length === 0}
              >
                {selectedTraderIds.size === paginatedTraders.length ? (
                  <CheckSquare className="h-5 w-5 text-sky-500" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
                <span>
                  {selectedTraderIds.size === paginatedTraders.length
                    ? 'Deselect All'
                    : 'Select All'}
                </span>
              </button>
              {selectedTraderIds.size > 0 && (
                <span className="text-sm text-gray-300">{selectedTraderIds.size} selected</span>
              )}
            </div>

            {/* Sort Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Sort:</span>
              {[
                { field: 'name' as SortField, label: 'Name' },
                { field: 'createdAt' as SortField, label: 'Created' },
                { field: 'aggressivenessLevel' as SortField, label: 'Aggressiveness' },
                { field: 'riskPreferenceScore' as SortField, label: 'Risk Score' },
              ].map(({ field, label }) => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    sortField === field
                      ? 'bg-sky-500 text-white'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {label}
                  <SortAsc
                    className={`h-3.5 w-3.5 ${sortField === field && sortOrder === 'desc' ? 'rotate-180' : ''}`}
                  />
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {selectedTraderIds.size > 0 ? (
                <>
                  <button
                    onClick={clearSelection}
                    className="rounded-lg bg-gray-700 px-4 py-2.5 text-gray-300 hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={isBatchDeleting}
                    className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedTraderIds.size}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsAiGenerateModalOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/30 text-sm"
                  >
                    <Sparkles className="h-4 w-4" />
                    AI+
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-white font-medium hover:from-sky-600 hover:to-blue-700 transition-all shadow-lg shadow-sky-500/30 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Trader
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Trader Cards Grid */}
          {paginatedTraders.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#2D2D2D' }}>
              <p className="text-lg text-gray-400">No matching traders found</p>
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {paginatedTraders.map((trader) => (
                <TraderCard
                  key={trader.id}
                  trader={trader}
                  onEdit={() => setEditingTrader(trader)}
                  onDelete={() => setDeletingTraderId(trader.id)}
                  onViewPositions={() => handleViewPositions(trader.id)}
                  isSelected={selectedTraderIds.has(trader.id)}
                  onToggleSelect={() => toggleTraderSelection(trader.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between rounded-2xl p-6"
              style={{ backgroundColor: '#2D2D2D' }}
            >
              <div className="text-sm text-gray-400">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedTraders.length)}{' '}
                of {sortedTraders.length}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-sky-500 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                >
                  Last
                </button>
              </div>
            </div>
          )}

          {/* Create Modal */}
          <CreateTraderModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleCreateTrader}
          />

          {/* AI Generate Modal */}
          <AiGenerateModal
            isOpen={isAiGenerateModalOpen}
            onClose={() => {
              setIsAiGenerateModalOpen(false);
              // Refresh traders when closing
              fetchTraders();
            }}
            onStart={(count) => {
              console.log(`Started generating ${count} traders`);

              // Auto-refresh every 5 seconds for up to 2 minutes
              let refreshCount = 0;
              const maxRefreshes = 24; // 24 * 5 = 120 seconds

              const refreshInterval = setInterval(() => {
                // Only fetch if component is still mounted
                if (isMounted.current) {
                  fetchTraders();
                }
                refreshCount++;

                if (refreshCount >= maxRefreshes) {
                  clearInterval(refreshInterval);
                  console.log('Stopped auto-refresh after 2 minutes');
                }
              }, 5000);

              // Save interval ID to clear it if needed
              if (isMounted.current) {
                (
                  window as Window & { traderRefreshInterval?: ReturnType<typeof setInterval> }
                ).traderRefreshInterval = refreshInterval;
              }
            }}
          />

          {/* Edit Modal */}
          {editingTrader && (
            <EditTraderModal
              trader={editingTrader}
              onClose={() => setEditingTrader(null)}
              onUpdate={handleUpdateTrader}
            />
          )}

          {/* Delete Confirmation Modal */}
          {deletingTraderId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div
                className="w-full max-w-md rounded-2xl p-8"
                style={{ backgroundColor: '#2D2D2D' }}
              >
                <h3 className="text-2xl font-bold text-white mb-4">Confirm Deletion</h3>
                <p className="text-gray-300 mb-6">
                  Are you sure you want to delete trader &ldquo;
                  {traders.find((t) => t.id === deletingTraderId)?.name}&rdquo;? This action cannot
                  be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeletingTraderId(null)}
                    className="rounded-lg px-6 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteTrader(deletingTraderId)}
                    className="rounded-lg bg-red-500 px-6 py-3 text-white hover:bg-red-600 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

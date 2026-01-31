'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import { Search, SortAsc, ChevronDown, X, Briefcase } from 'lucide-react';
import PositionCard from './position-card';
import PositionDetailsModal from './position-details-modal';
import ClosePositionModal from './close-position-modal';
import type { Position } from '@/db/schema';

interface TradingPair {
  id: number;
  symbol: string;
}

interface Trader {
  id: number;
  name: string;
}

interface PositionWithRelations extends Position {
  trader: Trader;
  tradingPair: TradingPair;
}

interface PositionHistory {
  id: number;
  positionId: number;
  action: string;
  details: string | null;
  createdAt: Date;
}

interface ApiPositionResponse {
  position: Position;
  trader: Trader;
  tradingPair: TradingPair;
}

type SortField = 'openedAt' | 'unrealizedPnl' | 'margin' | 'leverage';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'open' | 'closed' | 'liquidated';
type SideFilter = 'all' | 'long' | 'short';

export default function PositionsAdminPage() {
  const searchParams = useSearchParams();
  const traderIdParam = searchParams.get('traderId');

  const [positions, setPositions] = useState<PositionWithRelations[]>([]);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [traderFilter, setTraderFilter] = useState<number | null>(
    traderIdParam ? parseInt(traderIdParam) : null
  );

  // Sorting
  const [sortField, setSortField] = useState<SortField>('openedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Modals
  const [selectedPosition, setSelectedPosition] = useState<PositionWithRelations | null>(null);
  const [closingPositionId, setClosingPositionId] = useState<number | null>(null);
  const [positionHistory, setPositionHistory] = useState<PositionHistory[]>([]);

  // Track if component is mounted
  const isMounted = useRef(true);

  // Position price auto-update setting
  const [positionPriceAutoUpdate, setPositionPriceAutoUpdate] = useState(true);

  // Fetch system settings for position price auto-update
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await fetch('/api/admin/system-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPositionPriceAutoUpdate(data.data.system_enabled?.value === 'true');
          }
        }
      } catch (error) {
        console.error('Error fetching system settings:', error);
      }
    };

    fetchSystemSettings();
  }, []);

  // Fetch positions and traders
  useEffect(() => {
    isMounted.current = true;
    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auto-refresh for price updates (incremental update, no flicker)
  useEffect(() => {
    if (!positionPriceAutoUpdate) {
      return;
    }

    // Update prices every 3 seconds
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch('/api/positions/price-updates');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Incremental update: only update price-related fields
            setPositions((prevPositions) =>
              prevPositions.map((pos) => {
                const update = result.data.find(
                  (u: { positionId: number }) => u.positionId === pos.id
                );
                if (update) {
                  return {
                    ...pos,
                    currentPrice: update.currentPrice,
                    unrealizedPnl: update.unrealizedPnl,
                  };
                }
                return pos;
              })
            );
          }
        }
      } catch (error) {
        console.error('[PositionsPage] Error in price update:', error);
      }
    }, 3000); // 3 seconds

    return () => clearInterval(intervalId);
  }, [positionPriceAutoUpdate]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch positions
      const positionsResponse = await fetch('/api/positions');
      if (positionsResponse.ok) {
        const positionsData = await positionsResponse.json();
        if (isMounted.current) {
          // Transform API response to match PositionWithRelations
          const transformedPositions = positionsData.data.map((item: ApiPositionResponse) => ({
            ...item.position,
            trader: item.trader,
            tradingPair: item.tradingPair,
          }));
          setPositions(transformedPositions);
        }
      }

      // Fetch traders
      const tradersResponse = await fetch('/api/traders');
      if (tradersResponse.ok) {
        const tradersData = await tradersResponse.json();
        if (isMounted.current) {
          setTraders(tradersData);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Filter positions
  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      // Search query
      const matchesSearch =
        position.tradingPair.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        position.trader.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || position.status === statusFilter;

      // Side filter
      const matchesSide = sideFilter === 'all' || position.side === sideFilter;

      // Trader filter
      const matchesTrader = !traderFilter || position.traderId === traderFilter;

      return matchesSearch && matchesStatus && matchesSide && matchesTrader;
    });
  }, [positions, searchQuery, statusFilter, sideFilter, traderFilter]);

  // Sort positions
  const sortedPositions = useMemo(() => {
    return [...filteredPositions].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      // Handle numeric fields
      if (sortField === 'unrealizedPnl' || sortField === 'margin' || sortField === 'leverage') {
        const aNum = parseFloat(String(aValue));
        const bNum = parseFloat(String(bValue));
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Handle date fields
      if (sortField === 'openedAt') {
        const aDate = new Date(String(aValue));
        const bDate = new Date(String(bValue));
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      return 0;
    });
  }, [filteredPositions, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedPositions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPositions = sortedPositions.slice(startIndex, startIndex + itemsPerPage);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sideFilter, traderFilter, itemsPerPage]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleViewDetails = async (position: PositionWithRelations) => {
    try {
      const response = await fetch(`/api/positions/${position.id}/history`);
      if (response.ok) {
        const data = await response.json();
        setPositionHistory(data.data);
      }
    } catch (error) {
      console.error('Error fetching position history:', error);
    }
    setSelectedPosition(position);
  };

  const handleClosePosition = (positionId: number) => {
    setClosingPositionId(positionId);
  };

  const handlePositionClosed = () => {
    setClosingPositionId(null);
    fetchData(); // Refresh positions
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
            <h1 className="text-3xl font-bold text-white">Position Management</h1>
          </div>

          {/* Filters and Search */}
          <div className="mb-6 rounded-2xl p-6" style={{ backgroundColor: '#2D2D2D' }}>
            <div className="flex flex-wrap items-center gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search pair or trader..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="appearance-none rounded-lg bg-gray-700/50 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="liquidated">Liquidated</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Side Filter */}
              <div className="relative">
                <select
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value as SideFilter)}
                  className="appearance-none rounded-lg bg-gray-700/50 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Sides</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Trader Filter */}
              <div className="relative">
                <select
                  value={traderFilter || 'all'}
                  onChange={(e) =>
                    setTraderFilter(e.target.value === 'all' ? null : parseInt(e.target.value))
                  }
                  className="appearance-none rounded-lg bg-gray-700/50 px-4 py-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="all">All Traders</option>
                  {traders.map((trader) => (
                    <option key={trader.id} value={trader.id}>
                      {trader.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* Items Per Page */}
              <div className="relative">
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
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

          {/* Sort Controls */}
          <div
            className="mb-6 rounded-2xl p-4 flex items-center justify-between gap-4"
            style={{ backgroundColor: '#2D2D2D' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Sort:</span>
              {[
                { field: 'openedAt' as SortField, label: 'Opened' },
                { field: 'unrealizedPnl' as SortField, label: 'PnL' },
                { field: 'margin' as SortField, label: 'Margin' },
                { field: 'leverage' as SortField, label: 'Leverage' },
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

            <div className="text-sm text-gray-400">
              {sortedPositions.length} position{sortedPositions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Position Cards Grid */}
          {paginatedPositions.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#2D2D2D' }}>
              <Briefcase className="mx-auto h-16 w-16 text-gray-500 mb-4" />
              <p className="text-lg text-gray-400">No positions found</p>
              {traderFilter && (
                <button
                  onClick={() => setTraderFilter(null)}
                  className="mt-4 text-sky-400 hover:text-sky-300"
                >
                  Clear trader filter
                </button>
              )}
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  onViewDetails={() => handleViewDetails(position)}
                  onClosePosition={() => handleClosePosition(position.id)}
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
                Showing {startIndex + 1}-
                {Math.min(startIndex + itemsPerPage, sortedPositions.length)} of{' '}
                {sortedPositions.length}
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

          {/* Position Details Modal */}
          {selectedPosition && (
            <PositionDetailsModal
              position={selectedPosition}
              history={positionHistory}
              onClose={() => setSelectedPosition(null)}
            />
          )}

          {/* Close Position Modal */}
          {closingPositionId && (
            <ClosePositionModal
              positionId={closingPositionId}
              onClose={() => setClosingPositionId(null)}
              onClosed={handlePositionClosed}
            />
          )}
        </main>
      </div>
    </div>
  );
}

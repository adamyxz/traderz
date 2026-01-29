'use client';

import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import { TrendingUp, Users, Clock, AlertTriangle, Send, Plus, MoreHorizontal } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
      <AdminSidebar />
      <div className="ml-20">
        <AdminHeader />
        <main className="p-8">
          {/* Main Grid Layout */}
          <div className="grid grid-cols-3 gap-6">
            {/* Revenue Card - Coral Red */}
            <div
              className="relative overflow-hidden rounded-2xl p-6 text-white"
              style={{
                background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8787 100%)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">REVENUE</h3>
                <button className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm opacity-80">Gross Revenue</p>
                <p className="mt-1 text-3xl font-bold">$42,593</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span>12.5%</span>
                  <span className="opacity-70">vs last week</span>
                </div>
              </div>

              <div className="mb-2">
                <p className="text-sm opacity-80">Avg. Order Value</p>
                <p className="mt-1 text-2xl font-semibold">$28.50</p>
              </div>

              {/* Simple Bar Chart Visualization */}
              <div className="mt-6 flex items-end justify-between gap-1 h-20">
                {[65, 80, 95, 75, 85, 70, 90].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm bg-white/40"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs opacity-60">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>

            {/* Venue Capacity Card - Blue */}
            <div
              className="rounded-2xl p-6 text-white"
              style={{
                background: 'linear-gradient(135deg, #5E7CE0 0%, #7B9FF0 100%)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">VENUE CAPACITY</h3>
                <button className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm opacity-80">Current Occupancy</p>
                <p className="mt-1 text-3xl font-bold">78%</p>
                <div className="mt-3 h-2 rounded-full bg-white/20">
                  <div className="h-full w-[78%] rounded-full bg-white" />
                </div>
              </div>

              <div>
                <p className="text-sm opacity-80">Peak Hours</p>
                <p className="mt-1 text-lg font-semibold">12PM - 2PM</p>
              </div>

              {/* Location Dots */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-white" />
                  <span className="text-xs">Astoria</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-white/60" />
                  <span className="text-xs opacity-80">LIC</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-white/60" />
                  <span className="text-xs opacity-80">Rego Park</span>
                </div>
              </div>
            </div>

            {/* Points Card - Light Blue */}
            <div
              className="rounded-2xl p-6 text-white"
              style={{
                background: 'linear-gradient(135deg, #7DD3FC 0%, #9AE0F5 100%)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">POINTS</h3>
                <button className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm opacity-80">Loyalty Program</p>
                <p className="mt-1 text-3xl font-bold">2,847</p>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span>+234</span>
                  <span className="opacity-70">this week</span>
                </div>
              </div>

              {/* Map Placeholder */}
              <div className="mt-6 rounded-xl bg-white/20 p-4">
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-full ${
                        i % 3 === 0 ? 'bg-red-500' : 'bg-gray-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button className="mt-4 w-full rounded-lg bg-white/20 py-2 text-sm font-medium hover:bg-white/30 transition-colors">
                View all points
              </button>
            </div>

            {/* Operational Timing Card - Light Green */}
            <div
              className="rounded-2xl p-6 text-white"
              style={{
                background: 'linear-gradient(135deg, #A7F3D0 0%, #C7F5DD 100%)',
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">OPERATIONAL TIMING</h3>
                <button className="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm opacity-80">Service Hours</p>
                <p className="mt-1 text-2xl font-bold">7AM - 10PM</p>
              </div>

              {/* Circular Gauge */}
              <div className="mt-6 flex items-center justify-center">
                <div className="relative h-32 w-32">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="white"
                      strokeWidth="8"
                      strokeDasharray="188"
                      strokeDashoffset="47"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold">75%</p>
                      <p className="text-xs opacity-80">Peak</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Labor Cost Card - Dark Gray */}
            <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: '#2D2D2D' }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">STABILIZING LABOR COST</h3>
                  <p className="mt-1 text-sm text-gray-400">AI Recommendations</p>
                </div>
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-400">Current Cost</p>
                <p className="mt-1 text-2xl font-bold">$1,247</p>
              </div>

              <div className="mb-4 rounded-xl bg-yellow-500/10 p-3">
                <p className="text-sm text-yellow-500">⚠️ 12% above optimal</p>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <p className="text-sm text-gray-400">2:59:12 hours</p>
              </div>

              <button className="mt-4 w-full rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors">
                Show labor cost
              </button>
            </div>

            {/* AI Operations Card - Dark Gray */}
            <div className="rounded-2xl p-6 text-white" style={{ backgroundColor: '#2D2D2D' }}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">AI OPERATIONS LEAD</h3>
                  <p className="text-sm text-gray-400">Smart Assistant</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="mb-4 space-y-3">
                <div className="rounded-lg bg-gray-700/50 p-3">
                  <p className="text-sm">
                    Revenue is trending 12% higher this week. Consider increasing inventory for peak
                    hours.
                  </p>
                </div>

                <div className="ml-4 rounded-lg bg-sky-500/20 p-3">
                  <p className="text-sm">Approve critical alerts?</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mb-3 space-y-2">
                <button className="flex w-full items-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600 transition-colors">
                  <Send className="h-4 w-4" />
                  Show labor cost
                </button>
                <button className="flex w-full items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm text-white hover:bg-emerald-600 transition-colors">
                  <TrendingUp className="h-4 w-4" />
                  Initiate strategy planning
                </button>
              </div>

              {/* Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ask AI..."
                  className="flex-1 rounded-lg bg-gray-700/50 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 hover:bg-red-600 transition-colors">
                  <Plus className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

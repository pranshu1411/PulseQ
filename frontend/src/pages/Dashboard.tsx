import React from 'react';
import { Activity, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { JobEvent } from '../layouts/DashboardLayout';

type DashboardContextType = {
  events: JobEvent[];
  stats: { active: number; completed: number; failed: number; waiting: number };
};

export default function Dashboard() {
  const { events, stats } = useOutletContext<DashboardContextType>();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Active Jobs" value={stats.active} icon={<Activity className="text-blue-400" />} />
        <StatCard title="Completed" value={stats.completed} icon={<CheckCircle2 className="text-emerald-400" />} />
        <StatCard title="Failed" value={stats.failed} icon={<XCircle className="text-red-400" />} />
        <StatCard title="Waiting" value={stats.waiting} icon={<Clock className="text-amber-400" />} />
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Live Event Stream</h2>
          <div className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            {events.length} Events
          </div>
        </div>
        <div className="divide-y divide-neutral-800/50 max-h-[600px] overflow-y-auto p-2">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
              <Activity className="w-12 h-12 mb-4 opacity-20" />
              <p>Waiting for queue events...</p>
            </div>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="flex items-center p-4 hover:bg-neutral-800/40 rounded-lg transition-colors group">
                <div className="mr-4 mt-1 self-start">
                  {ev.type === 'active' && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />}
                  {ev.type === 'completed' && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
                  {ev.type === 'failed' && <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />}
                  {ev.type === 'waiting' && <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />}
                  {ev.type === 'progress' && <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className="text-sm font-medium text-neutral-200">
                      Job <span className="font-mono text-xs text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded ml-1">{ev.jobId}</span>
                    </p>
                    <span className="text-xs text-neutral-500 font-mono">
                      {new Date(ev.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-400 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-300">
                      {ev.queueName}
                    </span>
                    <span className="capitalize">{ev.type}</span>
                    {ev.type === 'progress' && ev.data !== undefined && (
                      <span className="text-indigo-400 font-medium">({String(ev.data)}%)</span>
                    )}
                    {ev.type === 'failed' && ev.failedReason && (
                      <span className="text-red-400 font-medium truncate max-w-xs">{ev.failedReason}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-neutral-400">{title}</h3>
        <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
    </div>
  );
}

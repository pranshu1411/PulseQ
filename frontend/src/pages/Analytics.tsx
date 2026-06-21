import { useEffect, useState } from 'react';
import { Activity, Server, AlertTriangle, RefreshCw, BarChart2, HeartPulse, Clock, Cpu, MemoryStick } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';

type WorkerNode = {
  id: string;
  hostname: string;
  status: string;
  last_heartbeat: string;
  current_jobs: number;
};

type Throughput = {
  timestamp: string;
  completed: number;
  failed: number;
};

type Latency = {
  averageWaitTimeMs: number;
  averageProcessingTimeMs: number;
};

type Failures = {
  reason: string;
  count: number;
};

type Retries = {
  retriedJobs: number;
  totalJobs: number;
  retryRate: number;
};

export default function Analytics() {
  const [workers, setWorkers] = useState<WorkerNode[]>([]);
  const [throughput, setThroughput] = useState<Throughput[]>([]);
  const [latency, setLatency] = useState<Latency>({ averageWaitTimeMs: 0, averageProcessingTimeMs: 0 });
  const [failures, setFailures] = useState<Failures[]>([]);
  const [retries, setRetries] = useState<Retries>({ retriedJobs: 0, totalJobs: 0, retryRate: 0 });
  const [workerMetrics, setWorkerMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate distinct colors for workers based on hostname to keep lines consistent
  const getWorkerColor = (hostname: string) => {
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };

  const fetchAnalytics = async () => {
    try {
      const headers = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      const [wRes, tRes, lRes, fRes, rRes, wmRes] = await Promise.all([
        axios.get('http://localhost:4000/jobs/analytics/workers', { withCredentials: true, headers }),
        axios.get('http://localhost:4000/jobs/analytics/throughput', { withCredentials: true, headers }),
        axios.get('http://localhost:4000/jobs/analytics/latency', { withCredentials: true, headers }),
        axios.get('http://localhost:4000/jobs/analytics/failures', { withCredentials: true, headers }),
        axios.get('http://localhost:4000/jobs/analytics/retries', { withCredentials: true, headers }),
        axios.get('http://localhost:4000/jobs/analytics/worker-metrics', { withCredentials: true, headers }),
      ]);

      setWorkers(wRes.data);
      setThroughput(tRes.data);
      setLatency(lRes.data);
      setFailures(fRes.data);
      setRetries(rRes.data);
      setWorkerMetrics(wmRes.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const recentWorkers = workers.slice(0, 5); // Limit chart lines to top 5 most recent workers to avoid legend overflow

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && workers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-indigo-400">
        <Activity className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-400">Avg Queue Wait Time</h3>
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">{formatMs(latency.averageWaitTimeMs)}</div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-400">Avg Processing Time</h3>
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">{formatMs(latency.averageProcessingTimeMs)}</div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-400">Job Retries</h3>
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
              <RefreshCw className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">{retries.retriedJobs} <span className="text-sm text-neutral-500 font-normal ml-2">/ {retries.totalJobs} total</span></div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-400">Retry Rate</h3>
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white">{(retries.retryRate * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Throughput Chart (takes up 2 columns) */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-medium text-white">Throughput Spikes (Last Hour)</h2>
            </div>
          </div>
          <div className="p-6 flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughput} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#525252" fontSize={12} tickMargin={10} />
                <YAxis stroke="#525252" fontSize={12} />
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <Tooltip
                  labelFormatter={(v) => formatTime(v)}
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', color: '#e5e5e5' }}
                  itemStyle={{ color: '#e5e5e5' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Area type="monotone" name="Completed" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                <Area type="monotone" name="Failed" dataKey="failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Node Health */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-medium text-white">Worker Node Health</h2>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              {workers.length} Nodes
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px]">
            {workers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-neutral-500">
                <HeartPulse className="w-8 h-8 mb-3 opacity-20" />
                <p className="text-sm">No worker nodes registered</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/50">
                {workers.map((w) => (
                  <div key={w.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${w.status === 'offline' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`} />
                        <span className="font-medium text-white text-sm">{w.hostname}</span>
                      </div>
                      <p className="text-xs text-neutral-500 ml-4">
                        Last ping: {new Date(w.last_heartbeat).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border ${w.status === 'offline' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                      {w.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worker CPU Utilization */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">CPU Utilization</h2>
          </div>
          <div className="p-6 flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workerMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#525252" fontSize={12} tickMargin={10} />
                <YAxis stroke="#525252" fontSize={12} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  labelFormatter={(v) => formatTime(v)}
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', color: '#e5e5e5' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  formatter={(value: number) => [`${value}%`, 'CPU Usage']}
                />
                <Legend verticalAlign="top" height={36} />
                {recentWorkers.map((w, i) => {
                  const colors = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
                  return (
                    <Line
                      key={w.id}
                      type="monotone"
                      dataKey={`${w.hostname}_cpu`}
                      name={w.hostname}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Worker Memory Usage */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-2">
            <MemoryStick className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-medium text-white">Memory Usage (MB)</h2>
          </div>
          <div className="p-6 flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workerMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} stroke="#525252" fontSize={12} tickMargin={10} />
                <YAxis stroke="#525252" fontSize={12} tickFormatter={(v) => `${v} MB`} />
                <Tooltip
                  labelFormatter={(v) => formatTime(v)}
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px', color: '#e5e5e5' }}
                  itemStyle={{ color: '#e5e5e5' }}
                  formatter={(value: number) => [`${value} MB`, 'Memory']}
                />
                <Legend verticalAlign="top" height={36} />
                {recentWorkers.map((w, i) => {
                  const colors = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
                  return (
                    <Line
                      key={w.id}
                      type="monotone"
                      dataKey={`${w.hostname}_memory`}
                      name={w.hostname}
                      stroke={colors[i % colors.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Failure Analytics Table */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h2 className="text-lg font-medium text-white">Failure Analytics (Top Reasons)</h2>
        </div>
        <div className="overflow-x-auto">
          {failures.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm">No failures recorded recently. Everything is running smoothly!</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900/50 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="px-6 py-3 font-medium">Error Message</th>
                  <th className="px-6 py-3 font-medium text-right">Occurrence Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {failures.map((f, i) => (
                  <tr key={i} className="hover:bg-neutral-800/20">
                    <td className="px-6 py-4 text-red-300 max-w-xl truncate" title={f.reason}>{f.reason}</td>
                    <td className="px-6 py-4 text-white text-right font-medium">{f.count} times</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

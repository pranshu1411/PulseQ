import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { Activity, CheckCircle2, Clock, XCircle, FileText, Image as ImageIcon, Menu, LayoutDashboard, Send } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type JobEvent = {
  queueName: string;
  jobId: string;
  type: 'active' | 'completed' | 'failed' | 'progress' | 'waiting';
  data?: unknown;
  failedReason?: string;
  timestamp: number;
};

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0, waiting: 0 });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const newSocket = io('http://localhost:4000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    const handleEvent = (type: JobEvent['type']) => (data: Record<string, unknown>) => {
      setEvents((prev) => [{ ...data, type, timestamp: Date.now() } as JobEvent, ...prev].slice(0, 100));
      
      setStats((prev) => {
        const next = { ...prev };
        if (type === 'active') {
          next.active++;
          if (next.waiting > 0) next.waiting--;
        }
        if (type === 'completed') {
          if (next.active > 0) next.active--;
          next.completed++;
        }
        if (type === 'failed') {
          if (next.active > 0) next.active--;
          next.failed++;
        }
        if (type === 'waiting') {
          next.waiting++;
        }
        return next;
      });
    };

    newSocket.on('jobActive', handleEvent('active'));
    newSocket.on('jobCompleted', handleEvent('completed'));
    newSocket.on('jobFailed', handleEvent('failed'));
    newSocket.on('jobProgress', handleEvent('progress'));
    newSocket.on('jobWaiting', handleEvent('waiting'));

    socketRef.current = newSocket;

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 transition-transform border-r border-neutral-800 bg-neutral-950",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="flex h-full flex-col px-3 py-4">
          <div className="flex items-center mb-8 px-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">PulseQ</span>
          </div>
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={cn("w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group", activeTab === 'dashboard' ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200")}>
              <LayoutDashboard className={cn("mr-3 w-5 h-5 transition-colors", activeTab === 'dashboard' ? "text-indigo-400" : "text-neutral-500 group-hover:text-neutral-300")} /> Dashboard
            </button>
            <button onClick={() => setActiveTab('submit')} className={cn("w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group", activeTab === 'submit' ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200")}>
              <Send className={cn("mr-3 w-5 h-5 transition-colors", activeTab === 'submit' ? "text-indigo-400" : "text-neutral-500 group-hover:text-neutral-300")} /> Submit Jobs
            </button>
          </nav>
        </div>
      </aside>

      <div className={cn("p-4 transition-all duration-300", isSidebarOpen ? "ml-64" : "ml-0")}>
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 mr-4 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-white tracking-tight capitalize">{activeTab}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3 mr-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isConnected ? "bg-emerald-400" : "bg-red-400")}></span>
              <span className={cn("relative inline-flex rounded-full h-3 w-3", isConnected ? "bg-emerald-500" : "bg-red-500")}></span>
            </span>
            <span className="text-sm font-medium text-neutral-400">{isConnected ? 'System Live' : 'Disconnected'}</span>
          </div>
        </header>

        {activeTab === 'dashboard' ? (
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
        ) : (
          <JobSubmitForm />
        )}
      </div>
    </div>
  );
}

function JobSubmitForm() {
  const [imageURL, setImageURL] = useState('https://picsum.photos/800/600');
  const [csvURL, setCsvURL] = useState('https://raw.githubusercontent.com/fivethirtyeight/data/master/airline-safety/airline-safety.csv');
  const [loading, setLoading] = useState(false);

  const submitImageJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:4000/jobs/image', {
        imageUrl: imageURL,
        operations: ['resize', 'compress'],
        metadata: { source: 'dashboard' }
      }, { withCredentials: true });
      alert('Image job submitted');
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert('Error: ' + e.message);
      } else {
        alert('An unknown error occurred');
      }
    }
    setLoading(false);
  };

  const submitCsvJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:4000/jobs/csv', {
        fileUrl: csvURL,
        batchSize: 10
      }, { withCredentials: true });
      alert('CSV job submitted');
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert('Error: ' + e.message);
      } else {
        alert('An unknown error occurred');
      }
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center"><ImageIcon className="mr-2" /> Image Processing Job</h2>
        <form onSubmit={submitImageJob} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Image URL</label>
            <input type="text" value={imageURL} onChange={e => setImageURL(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" required />
          </div>
          <button disabled={loading} type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition-colors w-full">Submit Image Job</button>
        </form>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center"><FileText className="mr-2" /> CSV Import Job</h2>
        <form onSubmit={submitCsvJob} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">CSV URL</label>
            <input type="text" value={csvURL} onChange={e => setCsvURL(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500" required />
          </div>
          <button disabled={loading} type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg transition-colors w-full">Submit CSV Job</button>
        </form>
      </div>
    </div>
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

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Menu, LayoutDashboard, Image as ImageIcon, FileText, LogOut, Database, History, ChevronDown, PlusCircle, BarChart2, AlertTriangle, Home } from 'lucide-react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type JobEvent = {
  queueName: string;
  jobId: string;
  jobName?: string;
  type: 'active' | 'completed' | 'failed' | 'progress' | 'waiting';
  data?: unknown;
  returnvalue?: any;
  failedReason?: string;
  timestamp: number;
  priority?: number;
};

export default function DashboardLayout() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0, waiting: 0 });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isAssignJobsOpen, setIsAssignJobsOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { user, checkAuth } = useAuth();
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    if (pathname === '/dashboard') return 'Dashboard';
    if (pathname === '/dashboard/analytics') return 'Analytics & Health';
    if (pathname === '/dashboard/history') return 'Job History';
    if (pathname === '/dashboard/submit-image') return 'Submit Image Job';
    if (pathname === '/dashboard/submit-csv') return 'Submit CSV Job';
    if (pathname === '/dashboard/csv-records') return 'CSV Records';
    if (pathname === '/dashboard/image-records') return 'Image Records';
    if (pathname === '/dashboard/dlq') return 'Dead-Letter Queue';
    if (pathname === '/dashboard/profile') return 'User Profile';
    return 'Dashboard';
  };

  useEffect(() => {
    document.title = `${getPageTitle(location.pathname)} | PulseQ`;
  }, [location.pathname]);

  const fetchInitialJobs = async () => {
    try {
      const [statsRes, jobsRes] = await Promise.all([
        axios.get('http://localhost:4000/jobs/stats', {
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }),
        axios.get('http://localhost:4000/jobs?limit=50', { withCredentials: true })
      ]);

      const clearedAtStr = localStorage.getItem('pulseq_events_cleared_at');
      const clearedAt = clearedAtStr ? parseInt(clearedAtStr, 10) : 0;

      const initialEvents: JobEvent[] = jobsRes.data.data
        .filter((job: any) => new Date(job.updated_at).getTime() > clearedAt && job.status !== 'purged')
        .map((job: any) => {
          let type: JobEvent['type'] = 'waiting';
          if (job.status === 'active') type = 'active';
          if (job.status === 'completed') type = 'completed';
          if (job.status === 'failed') type = 'failed';

          const rawError = job.error;
          const failedReason = typeof rawError === 'object' && rawError !== null
            ? rawError.message || JSON.stringify(rawError)
            : rawError;

          return {
            queueName: job.queue_name,
            jobId: job.id,
            jobName: job.name,
            type,
            failedReason,
            timestamp: new Date(job.updated_at).getTime()
          };
        });

      setStats(statsRes.data);
      setEvents(initialEvents);
    } catch (err) {
      console.error('Failed to fetch initial stats', err);
    }
  };

  useEffect(() => {
    fetchInitialJobs();

    const newSocket = io('http://localhost:4000', {
      transports: ['websocket'],
      withCredentials: true,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    const handleEvent = (type: JobEvent['type']) => async (data: Record<string, unknown>) => {
      const rawReason = data.failedReason;
      const failedReason = typeof rawReason === 'object' && rawReason !== null
        ? (rawReason as any).message || JSON.stringify(rawReason)
        : rawReason;

      setEvents((prev) => {
        const newEvent = { ...data, type, failedReason, timestamp: Date.now() } as JobEvent;
        console.log(`[handleEvent] type=${type} jobId=${newEvent.jobId} data=${JSON.stringify(data)}`);

        const existingIndex = prev.findIndex(e => e.jobId === newEvent.jobId);
        
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = newEvent;
          updated.splice(existingIndex, 1);
          return [newEvent, ...updated].slice(0, 100);
        }

        return [newEvent, ...prev].slice(0, 100);
      });

      if (type === 'completed') {
        toast.success(`Job ${data.jobName || data.jobId} completed successfully`);
      } else if (type === 'failed') {
        toast.error(`Job ${data.jobName || data.jobId} failed`);
      }

      // Re-fetch stats directly from the backend to ensure perfect accuracy
      // rather than trying to guess the counter increments/decrements.
      try {
        const statsRes = await axios.get('http://localhost:4000/jobs/stats', {
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        setStats(statsRes.data);
      } catch (e) {
        console.error('Failed to update stats on event', e);
      }
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

  const handleLogout = async () => {
    try {
      await axios.get('http://localhost:4000/auth/logout', { withCredentials: true });
      toast.success('Logged out successfully');
      await checkAuth(); // Will set user to null and trigger redirect
    } catch (error) {
      console.error('Logout failed', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-neutral-800 bg-neutral-950 flex flex-col",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="flex-1 flex flex-col py-4 overflow-y-auto overflow-x-hidden">
          <div className={cn("flex items-center mb-8", isSidebarOpen ? "px-6" : "px-0 justify-center")}>
            <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20", isSidebarOpen ? "mr-3" : "")}>
              <Activity className="w-5 h-5 text-white" />
            </div>
            {isSidebarOpen && <span className="text-xl font-bold tracking-tight text-white">PulseQ</span>}
          </div>

          <nav className={cn("space-y-1", isSidebarOpen ? "px-3" : "px-3")}>
            <NavLink
              to="/dashboard"
              end
              title="Dashboard"
              className={({ isActive }) => cn(
                "w-full flex items-center py-2.5 rounded-lg transition-all duration-200 group",
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
                isSidebarOpen ? "px-3" : "justify-center"
              )}
            >
              <LayoutDashboard className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3" : "")} />
              {isSidebarOpen && <span>Dashboard</span>}
            </NavLink>
            <NavLink
              to="/dashboard/history"
              title="Job History"
              className={({ isActive }) => cn(
                "w-full flex items-center py-2.5 rounded-lg transition-all duration-200 group",
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
                isSidebarOpen ? "px-3" : "justify-center"
              )}
            >
              <History className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3" : "")} />
              {isSidebarOpen && <span>Job History</span>}
            </NavLink>

            <NavLink
              to="/dashboard/analytics"
              title="Analytics & Health"
              className={({ isActive }) => cn(
                "w-full flex items-center py-2.5 rounded-lg transition-all duration-200 group",
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
                isSidebarOpen ? "px-3" : "justify-center"
              )}
            >
              <BarChart2 className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3" : "")} />
              {isSidebarOpen && <span>Analytics</span>}
            </NavLink>

            <NavLink
              to="/dashboard/dlq"
              title="Dead-Letter Queue"
              className={({ isActive }) => cn(
                "w-full flex items-center py-2.5 rounded-lg transition-all duration-200 group",
                isActive ? "bg-red-500/10 text-red-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
                isSidebarOpen ? "px-3" : "justify-center"
              )}
            >
              <AlertTriangle className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3 text-red-400" : "")} />
              {isSidebarOpen && <span>Dead-Letter Queue</span>}
            </NavLink>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (!isSidebarOpen) {
                    setSidebarOpen(true);
                    setIsAssignJobsOpen(true);
                  } else {
                    setIsAssignJobsOpen(!isAssignJobsOpen);
                  }
                }}
                title="Assign Jobs"
                className={cn("w-full flex items-center py-2.5 rounded-lg transition-all duration-200 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200", isSidebarOpen ? "px-3 justify-between" : "justify-center")}
              >
                <div className="flex items-center">
                  <PlusCircle className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3" : "")} />
                  {isSidebarOpen && <span>Assign Jobs</span>}
                </div>
                {isSidebarOpen && <ChevronDown className={cn("w-4 h-4 transition-transform duration-200 shrink-0", isAssignJobsOpen ? "rotate-180" : "")} />}
              </button>

              <div className={cn("overflow-hidden transition-all duration-200", isAssignJobsOpen && isSidebarOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0")}>
                <NavLink
                  to="/dashboard/submit-image"
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm",
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <ImageIcon className="mr-2 w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Image Job</span>
                </NavLink>
                <NavLink
                  to="/dashboard/submit-csv"
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm mt-1",
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <FileText className="mr-2 w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">CSV Job</span>
                </NavLink>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (!isSidebarOpen) {
                    setSidebarOpen(true);
                    setIsDataOpen(true);
                  } else {
                    setIsDataOpen(!isDataOpen);
                  }
                }}
                title="Data"
                className={cn("w-full flex items-center py-2.5 rounded-lg transition-all duration-200 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200", isSidebarOpen ? "px-3 justify-between" : "justify-center")}
              >
                <div className="flex items-center">
                  <Database className={cn("w-5 h-5 shrink-0", isSidebarOpen ? "mr-3" : "")} />
                  {isSidebarOpen && <span>Data</span>}
                </div>
                {isSidebarOpen && <ChevronDown className={cn("w-4 h-4 transition-transform duration-200 shrink-0", isDataOpen ? "rotate-180" : "")} />}
              </button>

              <div className={cn("overflow-hidden transition-all duration-200", isDataOpen && isSidebarOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0")}>
                <NavLink
                  to="/dashboard/csv-records"
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm",
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <FileText className="mr-2 w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">CSV Records</span>
                </NavLink>
                <NavLink
                  to="/dashboard/image-records"
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm mt-1",
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <ImageIcon className="mr-2 w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Image Records</span>
                </NavLink>
              </div>
            </div>
          </nav>
        </div>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-neutral-800">
          <Link to="/dashboard/profile" className={cn("flex items-center mb-4 hover:bg-neutral-800/50 p-2 rounded-lg transition-colors cursor-pointer", isSidebarOpen ? "justify-between" : "justify-center")}>
            <div className="flex items-center overflow-hidden" title={user?.name || 'User'}>
              <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.picture ? (
                  <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-neutral-400">{user?.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              {isSidebarOpen && (
                <div className="ml-3 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                </div>
              )}
            </div>
          </Link>
          <Link
            to="/"
            title="Home"
            className={cn("w-full flex items-center py-2 text-sm text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg transition-colors", isSidebarOpen ? "px-3" : "justify-center")}
          >
            <Home className={cn("w-4 h-4 shrink-0", isSidebarOpen ? "mr-2" : "")} />
            {isSidebarOpen && <span>Home</span>}
          </Link>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
            className={cn("w-full flex items-center py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors", isSidebarOpen ? "px-3" : "justify-center")}
          >
            <LogOut className={cn("w-4 h-4 shrink-0", isSidebarOpen ? "mr-2" : "")} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={cn("p-4 transition-all duration-300", isSidebarOpen ? "ml-64" : "ml-20")}>
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 mr-4 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-white tracking-tight capitalize">{getPageTitle(location.pathname)}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3 mr-2">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isConnected ? "bg-emerald-400" : "bg-red-400")}></span>
              <span className={cn("relative inline-flex rounded-full h-3 w-3", isConnected ? "bg-emerald-500" : "bg-red-500")}></span>
            </span>
            <span className="text-sm font-medium text-neutral-400">{isConnected ? 'System Live' : 'Disconnected'}</span>
          </div>
        </header>

        {/* Content Area */}
        <Outlet context={{
          events,
          stats,
          clearEvents: () => {
            setEvents([]);
            localStorage.setItem('pulseq_events_cleared_at', Date.now().toString());
          },
          refreshEvents: fetchInitialJobs
        }} />
      </div>
    </div>
  );
}

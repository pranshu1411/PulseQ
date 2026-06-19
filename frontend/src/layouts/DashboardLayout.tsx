import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Menu, LayoutDashboard, Image as ImageIcon, FileText, LogOut, Database, History, ChevronDown, PlusCircle } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
};

export default function DashboardLayout() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0, waiting: 0 });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isAssignJobsOpen, setIsAssignJobsOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(false);
  
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInitialJobs = async () => {
      try {
        const { data } = await axios.get('http://localhost:4000/jobs', { withCredentials: true });
        
        const initialStats = { active: 0, completed: 0, failed: 0, waiting: 0 };
        const initialEvents: JobEvent[] = data.map((job: any) => {
          let type: JobEvent['type'] = 'waiting';
          if (job.status === 'active') type = 'active';
          if (job.status === 'completed') type = 'completed';
          if (job.status === 'failed') type = 'failed';
          
          if (type === 'active') initialStats.active++;
          if (type === 'completed') initialStats.completed++;
          if (type === 'failed') initialStats.failed++;
          if (type === 'waiting') initialStats.waiting++;

          return {
            queueName: job.queue_name,
            jobId: job.id,
            jobName: job.name,
            type,
            failedReason: job.error,
            timestamp: new Date(job.updated_at).getTime()
          };
        });

        setStats(initialStats);
      } catch (err) {
        console.error('Failed to fetch initial stats', err);
      }
    };

    fetchInitialJobs();

    const newSocket = io('http://localhost:4000', {
      transports: ['websocket'],
      withCredentials: true,
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    const handleEvent = (type: JobEvent['type']) => (data: Record<string, unknown>) => {
      setEvents((prev) => [{ ...data, type, timestamp: Date.now() } as JobEvent, ...prev].slice(0, 100));
      
      if (type === 'completed') {
        toast.success(`Job ${data.jobName || data.jobId} completed successfully`);
      } else if (type === 'failed') {
        toast.error(`Job ${data.jobName || data.jobId} failed`);
      }

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
        "fixed top-0 left-0 z-40 h-screen w-64 transition-transform border-r border-neutral-800 bg-neutral-950 flex flex-col",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="flex-1 flex flex-col px-3 py-4">
          <div className="flex items-center mb-8 px-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-3 shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">PulseQ</span>
          </div>
          <nav className="space-y-1">
            <NavLink 
              to="/" 
              end
              className={({ isActive }) => cn(
                "w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group", 
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              <LayoutDashboard className="mr-3 w-5 h-5" /> Dashboard
            </NavLink>
            <NavLink 
              to="/history" 
              className={({ isActive }) => cn(
                "w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group", 
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              <History className="mr-3 w-5 h-5" /> Job History
            </NavLink>
            <div>
              <button
                onClick={() => setIsAssignJobsOpen(!isAssignJobsOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              >
                <div className="flex items-center">
                  <PlusCircle className="mr-3 w-5 h-5" /> Assign Jobs
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isAssignJobsOpen ? "rotate-180" : "")} />
              </button>
              
              <div className={cn("overflow-hidden transition-all duration-200", isAssignJobsOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0")}>
                <NavLink 
                  to="/submit-image" 
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm", 
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <ImageIcon className="mr-2 w-4 h-4" /> Image Job
                </NavLink>
                <NavLink 
                  to="/submit-csv" 
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm mt-1", 
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <FileText className="mr-2 w-4 h-4" /> CSV Job
                </NavLink>
              </div>
            </div>
            
            <div>
              <button
                onClick={() => setIsDataOpen(!isDataOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              >
                <div className="flex items-center">
                  <Database className="mr-3 w-5 h-5" /> Data
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isDataOpen ? "rotate-180" : "")} />
              </button>
              
              <div className={cn("overflow-hidden transition-all duration-200", isDataOpen ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0")}>
                <NavLink 
                  to="/csv-records" 
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm", 
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <FileText className="mr-2 w-4 h-4" /> CSV Records
                </NavLink>
                <NavLink 
                  to="/image-records" 
                  className={({ isActive }) => cn(
                    "w-full flex items-center pl-11 pr-3 py-2 rounded-lg transition-all duration-200 group text-sm mt-1", 
                    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                  )}
                >
                  <ImageIcon className="mr-2 w-4 h-4" /> Image Records
                </NavLink>
              </div>
            </div>
          </nav>
        </div>
        
        {/* User Profile & Logout */}
        <div className="p-4 border-t border-neutral-800">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0 overflow-hidden">
                {user?.picture ? (
                  <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-medium text-neutral-400">{user?.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </button>
        </div>
      </aside>

      <div className={cn("p-4 transition-all duration-300", isSidebarOpen ? "ml-64" : "ml-0")}>
        <header className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-800">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 mr-4 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-white tracking-tight capitalize">Dashboard</h1>
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
        <Outlet context={{ events, stats, clearEvents: () => setEvents([]) }} />
      </div>
    </div>
  );
}

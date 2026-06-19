import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Menu, LayoutDashboard, Send, LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type JobEvent = {
  queueName: string;
  jobId: string;
  type: 'active' | 'completed' | 'failed' | 'progress' | 'waiting';
  data?: unknown;
  failedReason?: string;
  timestamp: number;
};

export default function DashboardLayout() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, failed: 0, waiting: 0 });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    try {
      await axios.get('http://localhost:4000/auth/logout', { withCredentials: true });
      await checkAuth(); // Will set user to null and trigger redirect
    } catch (error) {
      console.error('Logout failed', error);
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
              to="/submit" 
              className={({ isActive }) => cn(
                "w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group", 
                isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              <Send className="mr-3 w-5 h-5" /> Submit Jobs
            </NavLink>
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
        <Outlet context={{ events, stats }} />
      </div>
    </div>
  );
}

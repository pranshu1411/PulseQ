import { useEffect } from 'react';
import { Activity, ArrowRight, Server, Zap, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = 'PulseQ | Distributed Job Queues';
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">PulseQ</span>
          </div>
          <div>
            {isAuthenticated ? (
              <Link 
                to="/dashboard" 
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="px-5 py-2 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 relative">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8">
            Distributed Job Queues, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Visualized.</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            PulseQ is an enterprise-grade background processing engine. Offload heavy CSV imports and image processing pipelines to scalable worker nodes, and monitor every heartbeat in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to={isAuthenticated ? "/dashboard" : "/login"}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center group"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Real-Time Processing</h3>
            <p className="text-neutral-400 leading-relaxed">
              Watch your jobs execute in real-time. Our WebSocket architecture streams live telemetry, logs, and progress bars directly to your dashboard.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Scalable Workers</h3>
            <p className="text-neutral-400 leading-relaxed">
              Spin up infinite worker nodes. The dashboard tracks CPU and Memory metrics for every node, allowing you to monitor infrastructure health at a glance.
            </p>
          </div>

          <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-6">
              <Database className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Dead-Letter Queues</h3>
            <p className="text-neutral-400 leading-relaxed">
              Never lose a failed job. Poison pills are safely isolated into our DLQ where you can analyze raw stack traces, fix your code, and replay thousands of jobs instantly.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center opacity-50">
            <Activity className="w-4 h-4 text-white mr-2" />
            <span className="font-semibold tracking-tight text-white text-sm">PulseQ</span>
          </div>
          <p className="text-neutral-500 text-sm">© {new Date().getFullYear()} PulseQ Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

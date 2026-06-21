import { useEffect, useState } from 'react';
import { Activity, ArrowRight, Server, Zap, Database, Clock, Layers, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  const SLIDES = [
    '/slide1.png',
    '/slide2.png',
    '/slide3.png',
    '/slide4.png',
    '/slide5.png',
    '/slide6.png',
    '/slide7.png',
    '/slide8.png',
    '/slide9.png'
  ];

  useEffect(() => {
    document.title = 'PulseQ | Distributed Job Queues';
  }, []);

  useEffect(() => {
    if (SLIDES.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000); // Change slide every 4 seconds
    return () => clearInterval(interval);
  }, [SLIDES.length]);

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
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8"
          >
            Distributed Job Queues, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Visualized.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            PulseQ is an enterprise-grade background processing engine. Offload heavy CSV imports and image processing pipelines to scalable worker nodes, and monitor every heartbeat in real-time.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link 
              to={isAuthenticated ? "/dashboard" : "/login"}
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center group"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Dashboard Preview Image Slideshow */}
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="max-w-5xl mx-auto mt-20 relative z-10 perspective-[2000px]"
        >
          <div className="relative rounded-2xl bg-neutral-900/50 border border-neutral-800 p-2 md:p-4 backdrop-blur-sm shadow-2xl shadow-indigo-500/10 transform rotate-x-2 hover:rotate-x-0 transition-transform duration-700 ease-out">
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-neutral-800 shadow-inner bg-neutral-950">
              {SLIDES.map((slide, index) => (
                <img
                  key={index}
                  src={slide}
                  alt={`PulseQ Dashboard Preview ${index + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 relative' : 'opacity-0'}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=2000&q=80';
                  }}
                />
              ))}
            </div>

            {/* Slide Indicators */}
            {SLIDES.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? 'bg-indigo-500 w-6' : 'bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <div className="max-w-6xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Real-Time Processing</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Watch your jobs execute in real-time. Our WebSocket architecture streams live telemetry, logs, and progress bars directly to your dashboard.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Scalable Workers</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Spin up infinite worker nodes. The dashboard tracks CPU and Memory metrics for every node, allowing you to monitor infrastructure health at a glance.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-6">
              <Database className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Dead-Letter Queues</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Never lose a failed job. Poison pills are safely isolated into our DLQ where you can analyze raw stack traces, fix your code, and replay thousands of jobs instantly.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-6">
              <Layers className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Priority QoS Queuing</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Guarantee SLA compliance. Under the hood, BullMQ routes high-priority jobs into native Redis Sorted Sets, mathematically guaranteeing enterprise clients skip the line.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-6">
              <Clock className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Precision Scheduling</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Schedule batch processing for off-peak hours. Jobs are held in Redis until the exact millisecond their delay expires, waking up workers instantly without database polling.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl backdrop-blur-sm relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3 relative z-10">Fair-Share Throttling</h3>
            <p className="text-neutral-400 leading-relaxed relative z-10">
              Protect your infrastructure. A highly-indexed concurrent tenant limiter prevents any single user from monopolizing worker nodes and starving the rest of the system.
            </p>
          </motion.div>
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

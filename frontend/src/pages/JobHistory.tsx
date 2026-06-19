import { useEffect, useState, Fragment } from 'react';
import axios from 'axios';
import { History, Activity, CheckCircle2, XCircle, Clock, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import JobHistoryModal from '../components/JobHistoryModal';

type Job = {
  id: string;
  name: string;
  queue_name: string;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`http://localhost:4000/jobs`, { 
          params: { page, limit: 10 },
          withCredentials: true 
        });
        setJobs(data.data);
        setMeta(data.meta);
      } catch (err) {
        console.error('Failed to fetch jobs', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [page]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="w-4 h-4 text-blue-400" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const groupedJobs = jobs.reduce((acc, job) => {
    const dateStr = new Date(job.created_at).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  return (
    <>
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50 mr-3">
              <History className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-medium text-white">Job History</h2>
          </div>
          {meta && (
            <div className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              {meta.total} Total Jobs
            </div>
          )}
        </div>

        <div className="overflow-x-auto flex-1 relative min-h-[400px]">
          {loading && (
            <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}
          
          {jobs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500 h-full">
              <History className="w-12 h-12 mb-4 opacity-20" />
              <p>No job history found.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-neutral-400">
              <thead className="text-xs uppercase bg-neutral-900/50 text-neutral-500 border-b border-neutral-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Job Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {Object.entries(groupedJobs).map(([date, dateJobs]) => (
                  <Fragment key={date}>
                    <tr className="bg-neutral-800/20 border-y border-neutral-800/50">
                      <td colSpan={5} className="px-6 py-3 font-semibold text-indigo-400 text-xs tracking-wider uppercase bg-indigo-500/5">
                        {date}
                      </td>
                    </tr>
                    {dateJobs.map((job) => (
                      <tr 
                        key={job.id} 
                        onClick={() => setSelectedJobId(job.id)}
                        className="hover:bg-neutral-800/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-neutral-300">
                          {job.name}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-neutral-500">{job.queue_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusBadgeClass(job.status)} capitalize`}>
                            {getStatusIcon(job.status)}
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                          {new Date(job.created_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4">
                          {job.queue_name === 'image-processing' && job.status === 'completed' && (
                            <div className="flex items-center gap-2">
                              <a 
                                href={`http://localhost:4000/jobs/${job.id}/download/thumbnail`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded transition-colors"
                              >
                                <Download className="w-3 h-3 mr-1" /> Thumb
                              </a>
                              <a 
                                href={`http://localhost:4000/jobs/${job.id}/download/compressed`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded transition-colors"
                              >
                                <Download className="w-3 h-3 mr-1" /> Comp
                              </a>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-900/50 mt-auto">
            <span className="text-sm text-neutral-400">
              Showing <span className="text-white font-medium">{(meta.page - 1) * meta.limit + 1}</span> to{' '}
              <span className="text-white font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> of{' '}
              <span className="text-white font-medium">{meta.total}</span> jobs
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedJobId && (
        <JobHistoryModal 
          jobId={selectedJobId} 
          onClose={() => setSelectedJobId(null)} 
        />
      )}
    </>
  );
}

import { useEffect, useState } from 'react';
import { X, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, Activity } from 'lucide-react';
import axios from 'axios';

type JobLog = {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
};

type JobDetails = {
  id: string;
  name: string;
  status: string;
  error: string | null;
  created_at: string;
  logs?: JobLog[];
};

interface JobHistoryModalProps {
  jobId: string;
  onClose: () => void;
}

export default function JobHistoryModal({ jobId, onClose }: JobHistoryModalProps) {
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const { data } = await axios.get(`http://localhost:4000/jobs/${jobId}`, {
          withCredentials: true,
        });
        setJob(data);
      } catch (err) {
        console.error('Failed to fetch job details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'retried':
        return <RefreshCw className="w-5 h-5 text-amber-400" />;
      case 'started':
        return <Activity className="w-5 h-5 text-blue-400" />;
      default:
        return <Clock className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Job History</h2>
            <p className="text-sm text-neutral-400 mt-1 font-mono">{jobId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-neutral-400">Loading job history...</p>
            </div>
          ) : !job ? (
            <div className="text-center py-12 text-neutral-500">
              Job not found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-neutral-800/30 border border-neutral-800/50">
                <div className="flex-1">
                  <p className="text-sm text-neutral-400">Type</p>
                  <p className="font-medium text-white capitalize">{job.name}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-neutral-400">Status</p>
                  <p className="font-medium text-white capitalize">{job.status}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-neutral-400">Created At</p>
                  <p className="font-medium text-white">
                    {new Date(job.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {job.error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                  {job.error}
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-neutral-300 uppercase tracking-wider mb-4 px-1">Event Timeline</h3>
                {job.logs && job.logs.length > 0 ? (
                  <div className="relative border-l border-neutral-800 ml-3 pl-6 space-y-6">
                    {job.logs.map((log) => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[35px] top-1 bg-neutral-900 rounded-full p-0.5">
                          {getEventIcon(log.event_type)}
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="font-medium text-white capitalize">{log.event_type}</span>
                            <span className="text-xs text-neutral-500 font-mono">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          {log.message && (
                            <p className="text-sm text-neutral-400 mt-1">{log.message}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 italic px-1">No logs available for this job.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, RotateCcw, Trash2, DatabaseZap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useOutletContext } from 'react-router-dom';
import JobHistoryModal from '../components/JobHistoryModal';
import { motion } from 'framer-motion';
import { API_BASE } from '../config';

type Job = {
  id: string;
  name: string | null;
  queue_name: string;
  status: string;
  payload: any;
  result: any | null;
  error: any | null;
  created_at: string;
  updated_at: string;
};

export default function DeadLetterQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayingAll, setReplayingAll] = useState(false);
  const [purgingAll, setPurgingAll] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'replay' | 'purge' | null>(null);
  const { refreshEvents } = useOutletContext<{ refreshEvents: () => void }>();

  const fetchDLQ = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/jobs?limit=100&status=failed`, {
        withCredentials: true,
      });
      setJobs(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch DLQ', err);
      toast.error('Failed to load Dead-Letter Queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDLQ();
  }, []);

  const executeReplayAll = async () => {
    try {
      setReplayingAll(true);
      setConfirmAction(null);
      const res = await axios.post(`${API_BASE}/jobs/dlq/replay-all`, {}, { withCredentials: true });
      toast.success(res.data.message || 'Jobs requeued successfully');
      fetchDLQ();
      refreshEvents();
    } catch (err) {
      console.error('Failed to replay jobs', err);
      toast.error('Failed to replay jobs');
    } finally {
      setReplayingAll(false);
    }
  };

  const executePurgeAll = async () => {
    try {
      setPurgingAll(true);
      setConfirmAction(null);
      const res = await axios.delete(`${API_BASE}/jobs/dlq/purge-all`, { withCredentials: true });
      toast.success(res.data.message || 'Jobs purged successfully');
      fetchDLQ();
      refreshEvents();
    } catch (err) {
      console.error('Failed to purge jobs', err);
      toast.error('Failed to purge jobs');
    } finally {
      setPurgingAll(false);
    }
  };

  const handleRetrySingle = async (jobId: string) => {
    try {
      await axios.post(`${API_BASE}/jobs/${jobId}/retry`, {}, { withCredentials: true });
      toast.success('Job requeued');
      fetchDLQ();
      refreshEvents();
    } catch (_) {
      toast.error('Failed to retry job');
    }
  };

  const handleDeleteSingle = async (jobId: string) => {
    try {
      await axios.delete(`${API_BASE}/jobs/dlq/${jobId}`, { withCredentials: true });
      toast.success('Job deleted');
      fetchDLQ();
      refreshEvents();
    } catch (_) {
      toast.error('Failed to delete job');
    }
  };

  const parseError = (error: any) => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2 text-red-500" />
            Dead-Letter Queue
          </h2>
          <p className="text-neutral-400 mt-1">Manage and replay permanently failed poison pill jobs.</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setConfirmAction('replay')}
            disabled={replayingAll || jobs.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {replayingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Replay All
          </button>
          <button
            onClick={() => setConfirmAction('purge')}
            disabled={purgingAll || jobs.length === 0}
            className="flex items-center px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purgingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete All
          </button>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center space-x-2">
            <DatabaseZap className="w-5 h-5 text-neutral-400" />
            <span className="font-medium text-neutral-200">Poison Pills ({jobs.length})</span>
          </div>
          <button onClick={fetchDLQ} className="text-neutral-400 hover:text-white p-1 rounded transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
              <DatabaseZap className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">DLQ is Empty</h3>
            <p className="text-neutral-400 max-w-sm">No permanently failed jobs found. Everything is running smoothly!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800">
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Job Name / ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Queue</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Failure Reason</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Failed At</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {jobs.map((job) => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-neutral-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedJobId(job.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-neutral-200">{job.name || 'Unnamed Job'}</div>
                      <div className="text-xs text-neutral-500 mt-1 font-mono">{job.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-neutral-300">
                        {job.queue_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-red-400 max-w-md truncate font-mono bg-red-500/10 px-2 py-1 rounded inline-block">
                        {parseError(job.error)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-400">
                      {formatDistanceToNow(new Date(job.updated_at), { addSuffix: true })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetrySingle(job.id);
                        }}
                        className="inline-flex items-center text-indigo-400 hover:text-indigo-300 transition-colors font-medium px-2"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingle(job.id);
                        }}
                        className="inline-flex items-center text-red-400 hover:text-red-300 transition-colors font-medium px-2 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedJobId && (
        <JobHistoryModal 
          jobId={selectedJobId} 
          onClose={() => setSelectedJobId(null)}
          onRetry={() => {
            fetchDLQ();
            setSelectedJobId(null);
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`p-6 border-b ${confirmAction === 'purge' ? 'border-red-900/30 bg-red-900/10' : 'border-indigo-900/30 bg-indigo-900/10'}`}>
              <div className="flex items-center mb-2">
                {confirmAction === 'purge' ? (
                  <AlertTriangle className="w-6 h-6 text-red-500 mr-2" />
                ) : (
                  <RotateCcw className="w-6 h-6 text-indigo-400 mr-2" />
                )}
                <h3 className="text-xl font-bold text-white">
                  {confirmAction === 'purge' ? 'Delete Dead-Letter Queue' : 'Replay All Failed Jobs'}
                </h3>
              </div>
              <p className="text-neutral-400 mt-2">
                {confirmAction === 'purge' 
                  ? 'This action will permanently delete all failed jobs from the database. They cannot be recovered. Are you absolutely sure?' 
                  : 'This will push all failed jobs back into the active queue to be re-processed by the workers. Do you want to proceed?'}
              </p>
            </div>
            <div className="p-4 bg-neutral-900 flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'purge' ? executePurgeAll : executeReplayAll}
                className={`px-4 py-2 rounded-lg font-medium text-white transition-colors flex items-center ${
                  confirmAction === 'purge' 
                    ? 'bg-red-600 hover:bg-red-500' 
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {confirmAction === 'purge' ? 'Yes, Delete Everything' : 'Yes, Replay All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

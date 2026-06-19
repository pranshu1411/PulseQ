import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SubmitCsvJob() {
  const [csvURL, setCsvURL] = useState('');
  const [loading, setLoading] = useState(false);

  const submitCsvJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:4000/jobs/csv', {
        fileUrl: csvURL,
        batchSize: 10
      }, { withCredentials: true });
      toast.success('CSV job submitted successfully!');
    } catch (e: unknown) {
      if (e instanceof Error) {
        toast.error('Error: ' + e.message);
      } else {
        toast.error('An unknown error occurred');
      }
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white">CSV Import Job</h2>
          <p className="text-neutral-400 mt-2 text-sm">
            Submit a CSV file URL to be parsed and processed in batches by the background workers.
          </p>
        </div>
        
        <form onSubmit={submitCsvJob} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">CSV URL</label>
            <input 
              type="text" 
              value={csvURL} 
              onChange={e => setCsvURL(e.target.value)} 
              placeholder="https://raw.githubusercontent.com/fivethirtyeight/data/master/airline-safety/airline-safety.csv"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-neutral-600" 
              required 
            />
          </div>
          <button 
            disabled={loading} 
            type="submit" 
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-all w-full shadow-lg shadow-emerald-500/20"
          >
            {loading ? 'Submitting...' : 'Submit CSV Job'}
          </button>
        </form>
      </div>
    </div>
  );
}

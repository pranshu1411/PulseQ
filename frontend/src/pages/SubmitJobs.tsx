import React, { useState } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

export default function SubmitJobs() {
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

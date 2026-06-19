import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SubmitImageJob() {
  const [jobName, setJobName] = useState('');
  const [imageURL, setImageURL] = useState('');
  const [loading, setLoading] = useState(false);

  const submitImageJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:4000/jobs/image', {
        jobName: jobName || undefined,
        imageUrl: imageURL,
        operations: ['resize', 'compress'],
        metadata: { source: 'dashboard' }
      }, { withCredentials: true });
      toast.success('Image job submitted successfully!');
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
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <ImageIcon className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white">Image Processing Job</h2>
          <p className="text-neutral-400 mt-2 text-sm">
            Submit an image URL to be resized and compressed by the background workers.
          </p>
        </div>
        
        <form onSubmit={submitImageJob} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Job Name (Optional)</label>
            <input 
              type="text" 
              value={jobName} 
              onChange={e => setJobName(e.target.value)} 
              placeholder="e.g. Profile Picture Processing"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600 mb-6" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Image URL</label>
            <input 
              type="text" 
              value={imageURL} 
              onChange={e => setImageURL(e.target.value)} 
              placeholder="https://picsum.photos/800/600"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600" 
              required 
            />
          </div>
          <button 
            disabled={loading} 
            type="submit" 
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-all w-full shadow-lg shadow-indigo-500/20"
          >
            {loading ? 'Submitting...' : 'Submit Image Job'}
          </button>
        </form>
      </div>
    </div>
  );
}

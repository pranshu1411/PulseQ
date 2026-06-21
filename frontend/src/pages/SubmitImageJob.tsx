import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Link as LinkIcon, UploadCloud, X, Plus } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SubmitImageJob() {
  const [jobName, setJobName] = useState('');
  const [priority, setPriority] = useState<number>(5);
  const [inputType, setInputType] = useState<'url' | 'file'>('url');
  
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  const [currentUrl, setCurrentUrl] = useState('');
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddUrl = () => {
    if (!currentUrl.trim()) return;
    if (imageURLs.length >= 10) return toast.error('Maximum of 10 URLs allowed.');
    
    if (!currentUrl.startsWith('http')) {
      return toast.error('Please enter a valid URL starting with http/https.');
    }

    setImageURLs([...imageURLs, currentUrl]);
    setCurrentUrl('');
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddUrl();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;

    const validFiles = newFiles.filter(f => f.type.startsWith('image/'));
    if (validFiles.length < newFiles.length) {
      toast.error('Some files were ignored because they are not images.');
    }

    const totalFiles = [...imageFiles, ...validFiles];
    if (totalFiles.length > 10) {
      toast.error('Maximum of 10 files allowed. Extra files were ignored.');
      setImageFiles(totalFiles.slice(0, 10));
    } else {
      setImageFiles(totalFiles);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitImageJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputType === 'file' && imageFiles.length === 0) {
      return toast.error('Please select at least one file to upload.');
    }
    if (inputType === 'url' && imageURLs.length === 0) {
      if (currentUrl.trim()) {
        // Automatically add if they forgot to press the + button
        handleAddUrl();
        return; // wait for next render or handle inline, but simple to just block
      }
      return toast.error('Please add at least one image URL.');
    }

    setLoading(true);
    try {
      let finalUrls: string[] = [];

      if (inputType === 'file') {
        const formData = new FormData();
        imageFiles.forEach(f => formData.append('files', f));
        
        const uploadRes = await axios.post('http://localhost:4000/jobs/upload/image', formData, {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        finalUrls = uploadRes.data.urls;
      } else {
        finalUrls = imageURLs;
      }

      await Promise.all(finalUrls.map(url => 
        axios.post('http://localhost:4000/jobs/image', {
          jobName: jobName || undefined,
          imageUrl: url,
          operations: ['resize', 'compress'],
          metadata: { source: 'dashboard', inputType, isBatch: finalUrls.length > 1 },
          priority: priority
        }, { withCredentials: true })
      ));
      
      toast.success(`Successfully submitted ${finalUrls.length} image job(s)!`);
      setJobName('');
      setImageURLs([]);
      setCurrentUrl('');
      setImageFiles([]);
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.data?.message) {
        let msg = e.response.data.message;
        if (Array.isArray(msg)) msg = msg.join(', ');
        toast.error('Error: ' + msg);
      } else if (e instanceof Error) {
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
            Provide up to 10 images to be resized and compressed by the background workers.
          </p>
        </div>
        
        <form onSubmit={submitImageJob} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Job Name (Optional)</label>
              <input 
                type="text" 
                value={jobName} 
                onChange={e => setJobName(e.target.value)} 
                placeholder="e.g. Profile Picture Batch"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Job Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all appearance-none"
              >
                <option value={1}>High Priority (Bypasses Queue)</option>
                <option value={5}>Normal Priority</option>
                <option value={10}>Low Priority (Background Task)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Input Source</label>
            <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 mb-4">
              <button
                type="button"
                onClick={() => setInputType('url')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-md text-sm font-medium transition-colors ${
                  inputType === 'url' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <LinkIcon className="w-4 h-4 mr-2" /> URLs (Max 10)
              </button>
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-md text-sm font-medium transition-colors ${
                  inputType === 'file' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <UploadCloud className="w-4 h-4 mr-2" /> Upload Files (Max 10)
              </button>
            </div>

            {inputType === 'url' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={currentUrl} 
                    onChange={e => setCurrentUrl(e.target.value)} 
                    onKeyDown={handleUrlKeyDown}
                    placeholder="https://picsum.photos/800/600"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-neutral-600" 
                  />
                  <button 
                    type="button"
                    onClick={handleAddUrl}
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium px-4 py-3 rounded-lg transition-colors border border-neutral-700 flex items-center shrink-0"
                  >
                    <Plus className="w-5 h-5 mr-1" /> Add
                  </button>
                </div>
                
                {imageURLs.length > 0 && (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-h-[200px] overflow-y-auto divide-y divide-neutral-800/50">
                    {imageURLs.map((url, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between group">
                        <div className="flex items-center min-w-0 mr-4">
                          <LinkIcon className="w-4 h-4 text-indigo-400 mr-3 shrink-0" />
                          <span className="text-sm text-neutral-300 truncate">{url}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setImageURLs(urls => urls.filter((_, i) => i !== idx))}
                          className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors shrink-0 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full space-y-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                  multiple
                />
                
                {imageFiles.length < 10 && (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-neutral-800 rounded-lg px-4 py-8 flex flex-col items-center justify-center text-neutral-500 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                  >
                    <UploadCloud className="w-6 h-6 mb-2 group-hover:text-indigo-400 transition-colors" />
                    <span className="text-sm font-medium group-hover:text-neutral-300 transition-colors">Click to browse or drag and drop</span>
                    <span className="text-xs text-neutral-600 mt-1">PNG, JPG, WEBP up to 20MB ({10 - imageFiles.length} slots left)</span>
                  </button>
                )}

                {imageFiles.length > 0 && (
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-h-[250px] overflow-y-auto divide-y divide-neutral-800/50">
                    {imageFiles.map((file, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between group">
                        <div className="flex items-center min-w-0 mr-4">
                          <ImageIcon className="w-4 h-4 text-indigo-400 mr-3 shrink-0" />
                          <div className="flex flex-col truncate">
                            <span className="text-sm text-neutral-200 truncate">{file.name}</span>
                            <span className="text-xs text-neutral-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setImageFiles(files => files.filter((_, i) => i !== idx))}
                          className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors shrink-0 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            disabled={loading || (inputType === 'file' ? imageFiles.length === 0 : (imageURLs.length === 0 && !currentUrl))} 
            type="submit" 
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-all w-full shadow-lg shadow-indigo-500/20 !mt-8"
          >
            {loading ? 'Submitting...' : `Submit Batch Job`}
          </button>
        </form>
      </div>
    </div>
  );
}

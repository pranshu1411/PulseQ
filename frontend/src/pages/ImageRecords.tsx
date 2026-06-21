import { useState, useEffect } from 'react';
import axios from 'axios';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

type ImageRecord = {
  id: string;
  originalUrl: string;
  thumbnailPath: string;
  compressedPath: string;
  format: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  job?: {
    id: string;
    name: string;
  } | null;
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function ImageRecords() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:4000/images`, {
          params: { page, limit: 10 },
          withCredentials: true,
        });
        setImages(res.data.data);
        setMeta(res.data.meta);
      } catch (err) {
        console.error('Failed to fetch image records', err);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [page]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-400" />
            Image Records
          </h1>
          <p className="text-neutral-400 text-sm mt-1">View processed images from background jobs</p>
        </div>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-neutral-800/50 text-neutral-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Original URL</th>
                <th className="px-6 py-4 font-medium">Job Info</th>
                <th className="px-6 py-4 font-medium">Format</th>
                <th className="px-6 py-4 font-medium">Dimensions</th>
                <th className="px-6 py-4 font-medium">Processed At</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {images.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    No records found
                  </td>
                </tr>
              ) : (
                images.map((img) => (
                  <tr key={img.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <a
                        href={img.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 max-w-[250px] truncate"
                        title={img.originalUrl}
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{img.originalUrl}</span>
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-neutral-200 font-medium">{img.job?.name || 'Unknown Job'}</span>
                        <span className="text-neutral-500 text-xs font-mono">{img.job?.id || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-300 uppercase">
                        {img.format || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {img.width && img.height ? `${img.width}x${img.height}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(img.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {img.job?.id ? (
                          <>
                            <a
                              href={`http://localhost:4000/jobs/${img.job.id}/download/thumbnail`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                            >
                              Thumbnail
                            </a>
                            <a
                              href={`http://localhost:4000/jobs/${img.job.id}/download/compressed`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-2 py-1 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                            >
                              Compressed
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-neutral-600">Downloads unavailable for legacy records</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-900/50">
            <span className="text-sm text-neutral-400">
              Showing <span className="text-white font-medium">{(meta.page - 1) * meta.limit + 1}</span> to{' '}
              <span className="text-white font-medium">{Math.min(meta.page * meta.limit, meta.total)}</span> of{' '}
              <span className="text-white font-medium">{meta.total}</span> results
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
    </motion.div>
  );
}

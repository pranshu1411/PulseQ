import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Camera, Trash2, Save, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function UserProfile() {
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.picture || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarPreview(user.picture || '');
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append('name', name);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await axios.patch('http://localhost:4000/auth/profile', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Profile updated successfully');
      await checkAuth(); // Refresh user context
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await axios.delete('http://localhost:4000/auth/profile', { withCredentials: true });
      toast.success('Account deleted');
      await checkAuth(); // This will log the user out
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete account');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-6">Profile Settings</h2>
        <div className="flex items-center gap-16 mb-16">
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-neutral-700 bg-neutral-800 shadow-inner">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-medium text-neutral-500">
                  {name?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
              title="Change Picture"
            >
              <Camera className="w-7 h-7 text-white" />
            </button>
          </div>
          <div className="flex flex-col justify-center">
            <h3 className="text-lg font-medium text-white mb-1.5">Profile Picture</h3>
            <p className="text-sm text-neutral-400 mb-4">Upload a new avatar. JPG, PNG, or WEBP.</p>
            <div className="flex space-x-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium text-white rounded-lg transition-colors shadow-sm"
              >
                Change Picture
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors shadow-sm"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Email Address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="block w-full px-4 py-3 bg-neutral-800/50 border border-neutral-800 rounded-lg text-neutral-500 cursor-not-allowed shadow-sm"
            />
            <p className="mt-2 text-xs text-neutral-500 flex items-center">
              <Mail className="w-3 h-3 mr-1 inline" />
              Your email is managed by your sign-in provider and cannot be changed here.
            </p>
          </div>

          <div className="pt-6 border-t border-neutral-800">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-indigo-500 disabled:opacity-50 shadow-sm"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-xl p-6 shadow-xl relative overflow-hidden mt-8">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>
        <h2 className="text-xl font-semibold text-red-400 mb-2 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Danger Zone
        </h2>
        <p className="text-sm text-neutral-400 mb-6">
          Permanently delete your account and all associated data. This action is irreversible and will delete all your jobs, products, and images immediately.
        </p>
        
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors font-medium text-sm"
          >
            Delete Account
          </button>
        ) : (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-4">
            <p className="text-sm text-red-200 font-medium">Are you absolutely sure you want to delete your account? This cannot be undone.</p>
            <div className="flex space-x-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium text-sm flex items-center disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Yes, delete my account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import SubmitImageJob from './pages/SubmitImageJob';
import SubmitCsvJob from './pages/SubmitCsvJob';
import CsvRecords from './pages/CsvRecords';
import JobHistory from './pages/JobHistory';
import ImageRecords from './pages/ImageRecords';
import UserProfile from './pages/UserProfile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-neutral-400 font-medium">Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="submit-image" element={<SubmitImageJob />} />
            <Route path="submit-csv" element={<SubmitCsvJob />} />
            <Route path="csv-records" element={<CsvRecords />} />
            <Route path="image-records" element={<ImageRecords />} />
            <Route path="history" element={<JobHistory />} />
            <Route path="profile" element={<UserProfile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

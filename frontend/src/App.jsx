import React, { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import PipelineDetailPage from './pages/PipelineDetailPage';
import TrendsPage from './pages/TrendsPage';
import { api } from './api';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('cp_token') || '');
  const [user, setUser] = useState(localStorage.getItem('cp_name') || '');
  const [page, setPage] = useState('dashboard');
  const [pipelines, setPipelines] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshPipelines = async () => {
    if (!token) return;

    try {
      const items = await api('/pipelines', { token });
      setPipelines(items);

      if (pipeline) {
        const current = items.find((item) => item.id === pipeline.id);
        if (current) {
          const updatedPipeline = await api(`/pipelines/${current.id}`, { token });
          setPipeline(updatedPipeline);
        }
      }
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.message.includes('Session')) signOut();
    }
  };

  useEffect(() => {
    refreshPipelines();
  }, [token]);

  const signIn = async (payload, isRegistering) => {
    setBusy(true);
    setError('');

    try {
      const result = await api(`/auth/${isRegistering ? 'register' : 'login'}`, {
        method: 'POST',
        body: payload,
      });

      localStorage.setItem('cp_token', result.access_token);
      localStorage.setItem('cp_name', result.name);
      setToken(result.access_token);
      setUser(result.name);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_name');
    setToken('');
    setUser('');
    setPipelines([]);
    setPipeline(null);
    setPage('dashboard');
  };

  const openPipeline = async (item) => {
    setError('');

    try {
      const detail = await api(`/pipelines/${item.id}`, { token });
      setPipeline(detail);
      setPage('detail');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const selectPage = (nextPage) => {
    setPage(nextPage);
    setError('');
  };

  const handleUploadComplete = async (pipelineId) => {
    await refreshPipelines();
    const detail = await api(`/pipelines/${pipelineId}`, { token });
    setPipeline(detail);
    setPage('detail');
  };

  if (!token) {
    return <LoginPage onSubmit={signIn} busy={busy} error={error} />;
  }

  return (
    <AppShell
      page={page}
      user={user}
      pipelines={pipelines}
      selectedPipeline={pipeline}
      error={error}
      onDismissError={() => setError('')}
      onNavigate={selectPage}
      onOpenPipeline={openPipeline}
      onSignOut={signOut}
    >
      {page === 'dashboard' && (
        <DashboardPage
          pipelines={pipelines}
          token={token}
          onOpen={openPipeline}
          onAdd={() => selectPage('upload')}
        />
      )}
      {page === 'upload' && (
        <UploadPage token={token} onDone={handleUploadComplete} />
      )}
      {page === 'detail' && pipeline && <PipelineDetailPage pipeline={pipeline} />}
      {page === 'trends' && (
        <TrendsPage pipelines={pipelines} token={token} onOpen={openPipeline} />
      )}
    </AppShell>
  );
}

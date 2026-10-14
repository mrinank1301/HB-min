import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Upload,
  X,
} from 'lucide-react';

function NavigationItem({ active, icon, children, onClick }) {
  return (
    <button className={`navitem ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export default function AppShell({
  page,
  user,
  pipelines,
  selectedPipeline,
  error,
  onDismissError,
  onNavigate,
  onOpenPipeline,
  onSignOut,
  children,
}) {
  const initials = user
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  const pageTitle =
    page === 'detail'
      ? selectedPipeline?.name.replaceAll('_', ' ')
      : page === 'upload'
        ? 'Upload logs'
        : page === 'trends'
          ? 'Trends & recommendations'
          : 'Dashboard';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">↗</span>
          <span>
            CritPath
            <small>PIPELINE INTELLIGENCE</small>
          </span>
        </div>

        <div className="navlabel">WORKSPACE</div>
        <NavigationItem
          active={page === 'dashboard'}
          icon={<LayoutDashboard size={17} />}
          onClick={() => onNavigate('dashboard')}
        >
          Dashboard
        </NavigationItem>
        <NavigationItem
          active={page === 'upload'}
          icon={<Upload size={17} />}
          onClick={() => onNavigate('upload')}
        >
          Upload logs
        </NavigationItem>
        <NavigationItem
          active={page === 'trends'}
          icon={<BarChart3 size={17} />}
          onClick={() => onNavigate('trends')}
        >
          Trends &amp; insights
        </NavigationItem>

        <div className="navlabel pipelines-label">PIPELINES</div>
        <div className="pipeline-nav">
          {pipelines.map((pipeline) => (
            <NavigationItem
              key={pipeline.id}
              active={selectedPipeline?.id === pipeline.id && page === 'detail'}
              icon={<span className={`nav-dot ${pipeline.status}`} />}
              onClick={() => onOpenPipeline(pipeline)}
            >
              {pipeline.name.replaceAll('_', ' ')}
            </NavigationItem>
          ))}
        </div>

        <div className="sidebottom">
          <div className="user-info">
            <span className="avatar">{initials}</span>
            <span>
              <b>{user}</b>
              <small>Workspace member</small>
            </span>
          </div>
          <button className="navitem" onClick={onSignOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Workspace <ChevronRight size={13} /> <b>{pageTitle}</b>
          </div>
          <div className="toplive">
            <span className="pulse" /> ALL SYSTEMS LIVE
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="alert">
              <AlertTriangle size={16} />
              {error}
              <button onClick={onDismissError} aria-label="Dismiss error">
                <X size={14} />
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

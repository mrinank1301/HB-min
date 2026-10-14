import React from 'react';

export default function StatCard({ title, value, foot, icon }) {
  return (
    <div className="card stat-card">
      <div className="stat-title">
        {title}
        <span>{React.cloneElement(icon, { size: 16 })}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}

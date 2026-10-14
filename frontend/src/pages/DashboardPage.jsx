import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ChevronRight, Clock3, Gauge, Plus, Workflow } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '../components/Badge';
import StatCard from '../components/StatCard';
import { api } from '../api';
import { money } from '../utils/format';

export default function DashboardPage({ pipelines, token, onOpen, onAdd }) {
  const avg = pipelines.length ? Math.round(pipelines.reduce((s, p) => s + p.health, 0) / pipelines.length) : 0;
  const breaches = pipelines.filter(p => p.prediction?.tag !== 'UNDER SLA');
  const [chart, setChart] = useState([]);
  useEffect(() => {
    let alive = true;
    if (pipelines[0])
      api(`/pipelines/${pipelines[0].id}`, {
        token
      }).then(p => {
        if (alive)
          setChart(p.history.map((r, i) => ({
            run: `Run ${i + 1}`,
            minutes: r.minutes
          })));
      }).catch(() => {
      });
    return () => {
      alive = false;
    };
  }, [pipelines,
    token]);
  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">PIPELINE MONITORING</span>
        <h1>Pipeline overview</h1>
        <p>A clear view of what’s running,
          what’s slowing down,
          and what needs attention.</p>
      </div>
      <button className="button primary" onClick={onAdd}>
        <Plus size={16} /> Add pipeline</button>
    </div>
    <div className="stat-grid">
      <StatCard title="AVG. PIPELINE HEALTH" value={`${avg}/100`} foot="Across monitored pipelines" icon={<Gauge />} />
      <StatCard title="ACTIVE PIPELINES" value={pipelines.length} foot="All pipelines reporting" icon={<Workflow />} />
      <StatCard title="PREDICTED BREACHES" value={breaches.length} foot="On upcoming runs" icon={<AlertTriangle />} />
      <StatCard title="TASKS AT RISK" value={pipelines.reduce((s, p) => s + p.bottleneck_count, 0)} foot="Bottlenecks identified" icon={<Activity />} />
    </div>
    <div className="two-col">
      <section className="card chart-card">
        <div className="card-head">
          <div>
            <h2>Run duration</h2>
            <p>Recent history · first monitored pipeline</p>
          </div>
          <span className="soft-pill">RUNTIME</span>
        </div>{chart.length ? <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60b984" stopOpacity={.28} />
                  <stop offset="100%" stopColor="#60b984" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#edf0ed" />
              <XAxis dataKey="run" tickLine={false} axisLine={false} tick={{
                fontSize: 10,
                fill: '#8b9991'
              }} />
              <YAxis tickLine={false} axisLine={false} tick={{
                fontSize: 10,
                fill: '#8b9991'
              }} />
              <Tooltip />
              <Area dataKey="minutes" stroke="#359568" fill="url(#g)" strokeWidth={2} name="Runtime (min)" />
            </AreaChart>
          </ResponsiveContainer>
        </div> : <div className="empty">
          <Clock3 />Pipeline run history will appear here after you upload logs.</div>}
      </section>
      <section className="card health-card">
        <div className="card-head">
          <div>
            <h2>Health by pipeline</h2>
            <p>Current score out of 100</p>
          </div>
        </div>
        <div className="health-list">{pipelines.map(p => <button className="health-line" key={p.id} onClick={() => onOpen(p)}>
          <span>{p.name.replaceAll('_', ' ')}
          </span>
          <b>{p.health}
          </b>
          <i>
            <em className={p.status} style={{
              width: `${p.health}%`
            }} />
          </i>
        </button>)}
        </div>
      </section>
    </div>
    <section className="card table-card">
      <div className="card-head">
        <div>
          <h2>All pipelines</h2>
          <p>Monitor health,
            runtimes,
            and upcoming SLAs</p>
        </div>
        <button className="button subtle" onClick={onAdd}>
          <Plus size={15} /> Add pipeline</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>PIPELINE</th>
              <th>STATUS</th>
              <th>HEALTH</th>
              <th>CRITICAL PATH</th>
              <th>NEXT RUN</th>
              <th />
            </tr>
          </thead>
          <tbody>{pipelines.map(p => <tr key={p.id} onClick={() => onOpen(p)}>
            <td>
              <b>{p.name.replaceAll('_', ' ')}
              </b>
              <small>{p.domain}
                · {p.run_count}
                runs</small>
            </td>
            <td>
              <Badge status={p.status} />
            </td>
            <td>{p.health}
              /100</td>
            <td>{money(p.median_runtime)}
            </td>
            <td>
              <Badge status={p.prediction?.tag === 'UNDER SLA' ? 'good' : p.prediction?.tag === 'LIKELY BREACH' ? 'warning' : 'critical'}>{p.prediction?.tag || 'NO FORECAST'}
              </Badge>
            </td>
            <td>
              <ChevronRight size={16} />
            </td>
          </tr>)}
          </tbody>
        </table>{!pipelines.length && <div className="empty">No pipelines yet. Upload your first task log and dependency graph.</div>}
      </div>
    </section>
  </>;
}

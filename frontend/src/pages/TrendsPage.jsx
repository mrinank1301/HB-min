import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowUpRight, Clock3, Gauge } from 'lucide-react';
import { Badge } from '../components/Badge';
import StatCard from '../components/StatCard';
import { api } from '../api';
import { label, money } from '../utils/format';

export default function TrendsPage({ pipelines, token, onOpen }) {
  const [id, setId] = useState('');
  const current = pipelines.find(p => String(p.id) === id) || pipelines[0];
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (current)
      api(`/pipelines/${current.id}`, {
        token
      }).then(setDetail).catch(() => {
      });
  }, [current?.id,
    token]);
  if (!current)
    return <div className="empty">Upload a pipeline to see trends and recommendations.</div>;
  const history = detail?.history || [];
  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">HISTORICAL SIGNALS</span>
        <h1>Trends &amp;
          recommendations</h1>
        <p>Track runtime,
          failures,
          and the tasks driving your pipeline health.</p>
      </div>
      <select value={current.id} onChange={e => setId(e.target.value)}>{pipelines.map(p => <option key={p.id} value={p.id}>{p.name.replaceAll('_', ' ')}
      </option>)}
      </select>
    </div>{detail ? <>
      <div className="stat-grid">
        <StatCard title="RUNS ANALYZED" value={detail.run_count} foot="Recorded pipeline runs" icon={<Clock3 />} />
        <StatCard title="RUNTIME VARIANCE Z" value={detail.runtime_variance_z.toFixed(2)} foot="Normalized runtime spread" icon={<Activity />} />
        <StatCard title="FAILURE RATE" value={`${(detail.failure_rate * 100).toFixed(1)}%`} foot="Failed or incomplete runs" icon={<AlertTriangle />} />
        <StatCard title="HEALTH SCORE" value={`${detail.health}/100`} foot={label(detail.status)} icon={<Gauge />} />
      </div>
      <div className="two-col">
        <section className="card chart-card">
          <div className="card-head">
            <div>
              <h2>Runtime trend</h2>
              <p>Historical duration · SLA {money(detail.sla_minutes)}
              </p>
            </div>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history.map((r, i) => ({
                run: `Run ${i + 1}`,
                minutes: r.minutes
              }))}>
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
                <ReferenceLine y={detail.sla_minutes} stroke="#cb8d2b" strokeDasharray="4 4" />
                <Bar dataKey="minutes" fill="#65b487" radius={[4,
                  4,
                  0,
                  0]} name="Runtime (min)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card health-card">
          <div className="card-head">
            <div>
              <h2>Health score breakdown</h2>
              <p>100 − 15 × bottlenecks − 25 × failure rate − 10 × runtime variance z</p>
            </div>
          </div>
          <div className="score-equation">
            <b>{detail.health}
            </b>
            <span>= 100 − {detail.bottlenecks.length * 15}
              bottlenecks − {(25 * detail.failure_rate).toFixed(1)}
              failures − {(10 * detail.runtime_variance_z).toFixed(1)}
              variance</span>
          </div>
          <div className="health-band">
            <span>Critical &lt;
              60</span>
            <span>Warning 60–79</span>
            <span>Good 80–100</span>
          </div>
        </section>
      </div>
      <section className="card table-card">
        <div className="card-head">
          <div>
            <h2>Recommendations</h2>
            <p>Ranked by critical path membership first</p>
          </div>
          <button className="button subtle" onClick={() => onOpen(current)}>Open pipeline <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="recs-grid">{detail.recommendations.map((r, i) => <div className="recommendation" key={i}>
          <span>0{i + 1}
          </span>
          <div>
            <b>{r.title}
            </b>
            <p>{r.body}
            </p>
          </div>
        </div>)}
        </div>
      </section>
    </> : <div className="empty">Loading pipeline analysis…</div>}
  </>;
}

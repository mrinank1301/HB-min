import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import { Activity, AlertTriangle, Gauge, Workflow } from 'lucide-react';
import { Badge } from '../components/Badge';
import StatCard from '../components/StatCard';
import { label, money } from '../utils/format';

export default function PipelineDetailPage({ pipeline: p }) {
  const nodes = useMemo(() => {
    const ranks = new Map();
    const byName = new Map(p.tasks.map(t => [t.name,
      t]));
    const depth = (t, stack = new Set()) => {
      if (ranks.has(t.name))
        return ranks.get(t.name);
      if (stack.has(t.name))
        return 0;
      stack.add(t.name);
      const d = t.dependencies.length ? 1 + Math.max(...t.dependencies.map(n => byName.get(n) ? depth(byName.get(n), stack) : 0)) : 0;
      stack.delete(t.name);
      ranks.set(t.name, d);
      return d;
    };
    p.tasks.forEach(t => depth(t));
    const groups = {};
    p.tasks.forEach(t => (groups[ranks.get(t.name)] ??= []).push(t));
    return p.tasks.map(t => ({
      id: String(t.id),
      position: {
        x: ranks.get(t.name) * 220 + 30,
        y: ((groups[ranks.get(t.name)] || []).indexOf(t)) * 105 + 35
      },
      data: {
        label: <div className={`flow-node ${t.critical_path ? 'on-path' : ''}`}>
          <b>{t.name}
          </b>
          <small>{money(t.median_minutes)}
          </small>{t.critical_path && <i>CRITICAL PATH</i>}
          {t.bottleneck && <em>BOTTLENECK</em>}
        </div>
      },
      style: {
        background: 'transparent',
        border: 0,
        width: 190
      },
      sourcePosition: 'right',
      targetPosition: 'left'
    }));
  }, [p]);
  const edges = p.tasks.flatMap(t => t.dependencies.map(dep => ({
    id: `${dep}-${t.id}`,
    source: String(p.tasks.find(x => x.name === dep)?.id),
    target: String(t.id),
    animated: p.critical_path.includes(dep) && p.critical_path.includes(t.name),
    style: {
      stroke: p.critical_path.includes(dep) && p.critical_path.includes(t.name) ? '#238858' : '#c8d2cb',
      strokeWidth: 2
    }
  })));
  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">{p.domain}
          · {p.run_count}
          RECORDED RUNS</span>
        <h1>{p.name.replaceAll('_', ' ')}
        </h1>
        <p>Dependency graph,
          health signals,
          and next run forecast.</p>
      </div>
      <Badge status={p.status} />
    </div>
    <div className="detail-stats">
      <StatCard title="HEALTH SCORE" value={`${p.health}/100`} foot={label(p.status)} icon={<Gauge />} />
      <StatCard title="CRITICAL PATH" value={money(p.critical_path_minutes)} foot={`${p.critical_path.length} dependent tasks`} icon={<Workflow />} />
      <StatCard title="BOTTLENECKS" value={p.bottlenecks.length} foot="Latest task runtime > 1.5× median" icon={<AlertTriangle />} />
      <StatCard title="FAILURE RATE" value={`${(p.failure_rate * 100).toFixed(0)}%`} foot={`${p.run_count} runs analyzed`} icon={<Activity />} />
    </div>
    <div className="detail-layout">
      <div>
        <section className="card flow-card">
          <div className="card-head">
            <div>
              <h2>Task dependency graph</h2>
              <p>Critical path highlighted · task duration uses median runtime</p>
            </div>
          </div>
          <div className="flow-wrap">
            <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{
              padding: .2
            }} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
              <Background color="#e9efea" gap={20} />
              <Controls />
              <MiniMap nodeColor={n => p.critical_path.includes(n.data.label?.props?.children?.[0]?.props?.children) ? '#8bc49e' : '#d9e7dc'} />
            </ReactFlow>
          </div>
        </section>
        <section className="card table-card">
          <div className="card-head">
            <div>
              <h2>Bottleneck watch</h2>
              <p>Latest task run compared with its median</p>
            </div>
            <Badge status={p.bottlenecks.length ? 'warning' : 'good'}>{p.bottlenecks.length}
              flagged</Badge>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TASK</th>
                  <th>MEDIAN</th>
                  <th>LATEST</th>
                  <th>CHANGE</th>
                  <th>PATH</th>
                  <th>SIGNAL</th>
                </tr>
              </thead>
              <tbody>{p.tasks.map(t => <tr key={t.id}>
                <td>
                  <b>{t.name}
                  </b>
                </td>
                <td>{money(t.median_minutes)}
                </td>
                <td>{t.latest_minutes == null ? '—' : money(t.latest_minutes)}
                </td>
                <td className={t.bottleneck ? 'danger' : ''}>{t.change_ratio == null ? '—' : `${((t.change_ratio - 1) * 100).toFixed(0)}%`}
                </td>
                <td>{t.critical_path ? 'Critical' : '—'}
                </td>
                <td>{t.bottleneck ? <Badge status="critical">Bottleneck</Badge> : <Badge status="good">Normal</Badge>}
                </td>
              </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="detail-side">
        <section className="card forecast-card">
          <span className="eyebrow">NEXT RUN FORECAST</span>
          <h2>{money(p.prediction.minutes)}
          </h2>
          <Badge status={p.prediction.tag === 'UNDER SLA' ? 'good' : p.prediction.tag === 'LIKELY BREACH' ? 'warning' : 'critical'}>{p.prediction.tag}
          </Badge>
          <div className="forecast-range">
            <span>{money(p.prediction.low)}
            </span>
            <div>
              <i style={{
                left: `${Math.min(96, p.prediction.minutes / p.sla_minutes * 70)}%`
              }} />
            </div>
            <span>{money(p.prediction.high)}
            </span>
          </div>
          <p>80% confidence interval · SLA {money(p.sla_minutes)}
          </p>
          <small>Model: {p.prediction.method === 'random_forest' ? 'Random Forest' : 'Median fallback (+10%)'}
            · ±15%</small>
        </section>
        <section className="card recommendations">
          <div className="card-head">
            <div>
              <h2>Recommendations</h2>
              <p>Critical path first</p>
            </div>
          </div>{p.recommendations.map((r, i) => <div className="recommendation" key={i}>
            <span>0{i + 1}
            </span>
            <div>
              <b>{r.title}
              </b>
              <p>{r.body}
              </p>
            </div>
          </div>)}
        </section>
        <section className="card trend-card">
          <div className="card-head">
            <div>
              <h2>Run history</h2>
              <p>Recent total runtime</p>
            </div>
          </div>
          <div className="mini-chart">{p.history.slice(-10).map((r, i) => <div key={r.id} title={`${money(r.minutes)} · ${r.status}`}>
            <i className={r.minutes > p.sla_minutes ? 'over' : ''} style={{
              height: `${Math.max(8, Math.min(100, r.minutes / Math.max(p.sla_minutes, ...p.history.map(x => x.minutes)) * 100))}%`
            }} />
            <small>{i + 1}
            </small>
          </div>)}
          </div>
        </section>
      </aside>
    </div>
  </>;
}

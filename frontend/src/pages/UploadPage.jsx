import React, { useState } from 'react';
import { ArrowUpRight, Database } from 'lucide-react';
import { api } from '../api';
import FilePick from '../components/FilePick';

export default function UploadPage({ token, onDone }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('Campus operations');
  const [sla, setSla] = useState('60');
  const [csv, setCsv] = useState(null);
  const [json, setJson] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!csv || !json) {
      setError('Select both the CSV run log and JSON dependency graph.');
      return;
    }
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('name', name || csv.name.replace(/\.csv$/i, '').replaceAll('_', ' '));
    fd.append('domain', domain);
    fd.append('sla_minutes', sla);
    fd.append('task_log', csv);
    fd.append('dependencies_file', json);
    try {
      const p = await api('/pipelines/upload', {
        method: 'POST',
        body: fd,
        token
      });
      onDone(p.id);
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setBusy(false);
    }
  };
  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">DATA IN · INSIGHT OUT</span>
        <h1>Upload pipeline logs</h1>
        <p>Bring your run history,
          or explore the campus sample pipelines.</p>
      </div>
    </div>
    <form className="card upload-form" onSubmit={submit}>
      <div className="card-head">
        <div>
          <h2>Import your pipeline</h2>
          <p>Choose a task log CSV and dependency graph JSON.</p>
        </div>
        <span className="soft-pill">
          <Database size={13} /> SECURE WORKSPACE</span>
      </div>
      <div className="upload-fields">
        <label>Pipeline name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. nightly_warehouse_load" />
        </label>
        <label>Team / domain<input value={domain} onChange={e => setDomain(e.target.value)} placeholder="Campus operations" />
        </label>
        <label>SLA target (minutes)<input type="number" min="1" step="1" required value={sla} onChange={e => setSla(e.target.value)} />
        </label>
      </div>
      <div className="file-grid">
        <FilePick title="Task run log" detail="CSV · task_name, start_time, end_time, cpu_usage, memory_usage, status" file={csv} onFile={setCsv} accept=".csv,text/csv" />
        <FilePick title="Dependency graph" detail="JSON · task names mapped to prerequisite task names" file={json} onFile={setJson} accept=".json,application/json" />
      </div>{error && <div className="form-error">{error}
      </div>}
      <div className="form-bottom">
        <div className="notice">Runs are grouped by calendar day in the timestamps. Files are processed by the API and saved to your workspace.</div>
        <button className="button primary" disabled={busy}>{busy ? 'Analyzing…' : <>Analyze pipeline <ArrowUpRight size={15} />
        </>}
        </button>
      </div>
    </form>
    <section className="sample-info">
      <div>
        <h2>Sample pipelines</h2>
        <p>Download a matching CSV and JSON pair, then select both above to import it.</p>
      </div>
      <div className="sample-chips">
        <span>✓ Healthy · Attendance sync · <a href="/samples/attendance_sync_daily/task_log.csv" download>CSV</a> · <a href="/samples/attendance_sync_daily/dependencies.json" download>JSON</a></span>
        <span>✓ Good · Semester results · <a href="/samples/semester_result_processing/task_log.csv" download>CSV</a> · <a href="/samples/semester_result_processing/dependencies.json" download>JSON</a></span>
        <span>△ Warning · Exam revaluation · <a href="/samples/exam_revaluation_batch/task_log.csv" download>CSV</a> · <a href="/samples/exam_revaluation_batch/dependencies.json" download>JSON</a></span>
        <span>! Critical · Placement drive · <a href="/samples/placement_drive_pipeline/task_log.csv" download>CSV</a> · <a href="/samples/placement_drive_pipeline/dependencies.json" download>JSON</a></span>
      </div>
    </section>
  </>;
}

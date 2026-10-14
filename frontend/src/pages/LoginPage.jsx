import React, { useState } from 'react';

export default function LoginPage({ onSubmit, busy, error }) {
  const [mode, setMode] = useState('login');
  return <div className="login-screen">
    <div className="login-promo">
      <div className="brand">
        <span className="brand-icon">↗</span>
        <span>CritPath<small>PIPELINE INTELLIGENCE</small>
        </span>
      </div>
      <div className="promo-copy">
        <span className="eyebrow">LESS GUESSWORK. MORE FLOW.</span>
        <h1>See the work that’s holding everything else up.</h1>
        <p>Critical path analysis for the data pipelines behind campus operations. Catch slowdowns early. Make every run count.</p>
      </div>
      <small className="login-foot">BUILT FOR SMALL DATA TEAMS · 2026</small>
    </div>
    <LoginForm mode={mode} setMode={setMode} onSubmit={onSubmit} busy={busy} error={error} />
  </div>;
}

function LoginForm({ mode, setMode, onSubmit, busy, error }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@critpath.io');
  const [password, setPassword] = useState('critpath-demo');
  const [org, setOrg] = useState('');
  return <div className="login-panel">
    <form className="login-form" onSubmit={e => {
      e.preventDefault();
      onSubmit(mode === 'login' ? {
        email,
        password
      }
        : {
          name,
          email,
          password,
          organization: org
        }, mode === 'register');
    }}>
      <span className="eyebrow">WELCOME {mode === 'login' ? 'BACK' : 'TO CRITPATH'}
      </span>
      <h2>{mode === 'login' ? 'Sign in to CritPath' : 'Create your workspace'}
      </h2>
      <p>Your pipeline health,
        all in one place.</p>{mode === 'register' && <>
          <label>Full name<input required value={name} onChange={e => setName(e.target.value)} placeholder="Alex Morgan" />
          </label>
          <label>Organization<input required value={org} onChange={e => setOrg(e.target.value)} placeholder="Campus Data Team" />
          </label>
        </>}
      <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@campus.edu" />
      </label>
      <label>Password<input type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} />
      </label>{error && <div className="form-error">{error}
      </div>}
      <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Continue to dashboard →' : 'Create account →'}
      </button>
      <div className="form-switch">{mode === 'login' ? <>New here? <button type="button" onClick={() => setMode('register')}>Create a workspace</button>
      </> : <>Already have an account? <button type="button" onClick={() => setMode('login')}>Sign in</button>
      </>}
      </div>{mode === 'login' && <div className="demo-hint">Demo account: <b>demo@critpath.io</b> / <b>critpath-demo</b>
      </div>}
    </form>
  </div>;
}

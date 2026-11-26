const TARGETS = [
  { name: 'portfolio', url: 'https://sachin-singh-tanwar.github.io/' },
  { name: 'gh_api', url: 'https://api.github.com/rate_limit' },
  { name: 'apify_api', url: 'https://api.apify.com/v2/store?limit=1' },
]

export function MethodScreen() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Method</p>
        <h1 className="hero-title">
          <span className="serif">method.</span>
        </h1>
        <p className="hero-caption">
          What is checked, how often, and exactly how the words on the status page are derived.
          No number on this site is typed in by hand.
        </p>
      </section>

      <section className="method-section">
        <h3>What is checked</h3>
        <p>
          Three public endpoints. No authentication, no personal data, and nothing that depends
          on a machine staying online at home.
        </p>
        <ul className="method-list">
          {TARGETS.map((target, index) => (
            <li key={target.name}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>
                <code>{target.name}</code> → <code>{target.url}</code>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="method-section">
        <h3>How often</h3>
        <p>
          GitHub Actions runs a scheduled audit at the cron times in the workflow; the expected
          interval used by the status math is 30 minutes. Each audit appends one record per target
          to a JSON file in the <code>data</code> branch. The frontend reads those files from
          raw.githubusercontent.com and computes every value in the browser.
        </p>
      </section>

      <section className="method-section">
        <h3>How states are derived</h3>
        <p>
          The expected interval is 30 minutes. For each target, take the timestamp of the most
          recent successful record and subtract it from now.
        </p>
        <div className="math-block">
          <div>
            <strong>age</strong>
            <span>
              <code>now - last_ok</code>, where <code>last_ok</code> is the newest record with{' '}
              <code>ok = true</code>
            </span>
          </div>
          <div>
            <strong>OPERATIONAL</strong>
            <span>
              <code>age &lt;= 1.5 * interval</code> → 45 minutes or less
            </span>
          </div>
          <div>
            <strong>DEGRADED</strong>
            <span>
              <code>1.5 * interval &lt; age &lt;= 3 * interval</code> → more than 45 minutes,
              up to 90 minutes
            </span>
          </div>
          <div>
            <strong>DOWN</strong>
            <span>
              <code>age &gt; 3 * interval</code> → more than 90 minutes
            </span>
          </div>
          <div>
            <strong>NEVER_RAN</strong>
            <span>no record with <code>ok = true</code> exists for that target</span>
          </div>
        </div>
        <p style={{ marginTop: 18 }}>
          Overall status is the worst target state. A target that has never run counts as
          degraded for the overall state.
        </p>
      </section>

      <section className="method-section">
        <h3>Incidents and uptime</h3>
        <p>
          An incident is a consecutive run of <code>ok = false</code> records for one target.
          Its start is the first failure in the streak. Duration is the first successful record
          after the streak minus that start; if there is no recovery yet, the incident is
          ongoing. MTTR is the duration of a resolved incident. Uptime is{' '}
          <code>ok_count / total_count</code> for a window of 24h, 7d, or 30d, excluding staged
          demo records. All three come from real records.
        </p>
      </section>

      <section className="method-section">
        <h3>Staged demo failures</h3>
        <p>
          Sending <code>workflow_dispatch</code> with <code>simulate_failure=true</code> makes
          the next four runs record a deliberate failure for one target. Runs with{' '}
          <code>staged=true</code> always carry a STAGED DEMO badge on every screen. A staged
          run is never presented as a real outage.
        </p>
      </section>

      <p className="disclosure">
        Tally runs on GitHub Actions. GitHub can delay scheduled runs; a late run is shown as
        late, not as a success.
      </p>
    </>
  )
}

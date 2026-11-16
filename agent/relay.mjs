// Relay: runs on a GitHub Actions runner (which can reach make.fun) and executes the plan in run/plan.json.
// Only public data travels here: signatures, addresses, hashes. Private keys never leave the owner's machine.
import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { publicEncrypt, constants } from 'node:crypto';

const ORIGIN = process.env.MAKEFUN_ORIGIN || 'https://make.fun';
const OUTDIR = 'relay-out';
mkdirSync(OUTDIR, { recursive: true });
const LOGFILE = `${OUTDIR}/run-${process.env.GITHUB_RUN_ID || Date.now()}.txt`;
writeFileSync(LOGFILE, `plan: ${process.env.GITHUB_RUN_ID || ''}\n`);
const rawLog = console.log.bind(console);
console.log = (...a) => { const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); appendFileSync(LOGFILE, line + '\n'); rawLog(line); };
const plan = JSON.parse(readFileSync('run/plan.json', 'utf8'));
// WATCHDOG: a poll must never outlive its own window, whatever a socket does.
const budget = plan.steps.reduce((m, st) => Math.max(m, (st.repeat || {}).maxWaitMs || st.maxWaitMs || 0), 0);
if (budget > 0) setTimeout(() => { console.log('[watchdog] budget spent, exiting'); process.exit(0); }, budget + 45000);
const retPub = existsSync('agent/return_pub.pem') ? readFileSync('tools/return_pub.pem', 'utf8') : null;

const seal = (value) => {
  if (!retPub) return `UNSEALED:${value}`;
  return publicEncrypt(
    { key: retPub, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(String(value), 'utf8')
  ).toString('base64');
};

const redact = (obj, fields) => {
  if (!fields || !obj) return obj;
  const copy = JSON.parse(JSON.stringify(obj));
  for (const f of fields) {
    if (copy[f] !== undefined && copy[f] !== null) copy[f] = `SEALED:${seal(copy[f])}`;
  }
  return copy;
};

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

async function doHttp(step) {
  const url = ORIGIN + step.path;
  const init = { method: step.method || 'GET', headers: { accept: 'application/json', ...(step.headers || {}) } };
  if (step.body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(step.body);
  }
  init.signal = AbortSignal.timeout(step.timeoutMs || 25000);
  let res;
  try { res = await fetch(url, init); } catch (e) { return { status: 0, json: null, text: `fetch failed: ${e.message}` }; }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

async function doShell(step) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('bash', ['-lc', step.cmd], { encoding: 'utf8', env: { ...process.env, ...(step.env || {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.status, text: `${r.stdout || ''}${r.stderr || ''}` };
}

for (const step of plan.steps) {
  const label = step.label || step.path || 'step';
  const repeat = step.repeat || (step.untilField ? { untilField: step.untilField, everyMs: step.everyMs || 5000, maxWaitMs: step.maxWaitMs || 600000 } : null);

  if (step.type === 'shell') {
    const r = await doShell(step);
    console.log(`[${label}] shell exit ${r.status}`);
    console.log(redactText(r.text, step.sealFields));
    if (step.stopOnFail && r.status !== 0) { console.log(`[${label}] STOP`); break; }
    continue;
  }

  if (!repeat) {
    const r = await doHttp(step);
    console.log(`[${label}] status ${r.status}`);
    const body = r.json ? redact(r.json, step.sealFields) : redactText(r.text, step.sealFields);
    console.log(JSON.stringify(body, null, 2).slice(0, 20000));
    if (step.stopOnFail && (r.status >= 400)) { console.log(`[${label}] STOP`); break; }
    continue;
  }

  const started = Date.now();
  let done = false;
  while (Date.now() - started < repeat.maxWaitMs) {
    const r = await doHttp(step);
    const hit = r.json && get(r.json, repeat.untilField) !== undefined && get(r.json, repeat.untilField) !== null;
    if (r.status < 300 && hit) {
      console.log(`[${label}] status ${r.status} DONE after ${Math.round((Date.now() - started) / 1000)}s`);
      console.log(JSON.stringify(redact(r.json, step.sealFields), null, 2).slice(0, 20000));
      done = true;
      break;
    }
    console.log(`[${label}] ${new Date().toISOString()} status ${r.status} ${r.json ? JSON.stringify(redact(r.json, step.sealFields)).slice(0, 300) : r.text.slice(0, 200)}`);
    if (r.json && ['access_denied', 'expired_token', 'invalid_grant'].includes(r.json.error)) { console.log(`[${label}] STOP ${r.json.error}`); break; }
    await new Promise((res) => setTimeout(res, repeat.everyMs));
  }
  if (!done) console.log(`[${label}] NOT DONE`);
  if (step.stopOnFail) break;
}

function redactText(text, fields) {
  if (!text || !fields) return text;
  let out = text;
  for (const f of fields) out = out.split(f).join('[redacted]');
  return out;
}

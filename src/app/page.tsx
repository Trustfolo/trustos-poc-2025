'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* =========================
Types (no `any`)
========================= */

type JsonObject = Record<string, unknown>

type TrustScoreResponse = {
ok: boolean;
address?: string;
score?: number; // 0-100
confidence?: number;
weights?: Record<string, number>
features?: Record<string, unknown>
ts?: string;
rpcError?: unknown;
[k: string]: unknown;
};

type DaoSubmitResponse = {
approved?: boolean;
txHash?: string;
yes?: number;
no?: number;
quorum?: number;
[k: string]: unknown;
};

type LedgerEntry = {
kind: string;
ledgerId: string;
height: number;
prevHash: string | null;
address: string;
score: number;
daoResult: DaoSubmitResponse;
createdAt: string;
hash: string;
[k: string]: unknown;
};

type VerifyResponse = {
ok: boolean;
valid?: boolean;
reason?: string;
hashOk?: boolean;
chainOk?: boolean;
[k: string]: unknown;
};

declare global {
interface Window {
ethereum?: {
isMetaMask?: boolean;
request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
on?: (event: string, handler: (...args: unknown[]) => void) => void;
removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};
}
}

/* =========================
Utils
========================= */

function safeStringify(v: unknown) {
try {
return JSON.stringify(v, null, 2);
} catch {
return String(v);
}
}

function nowStamp() {
const d = new Date();
const iso = d.toISOString();
return iso.replace('T', ' ').replace('Z', '');
}

function clamp(n: number, min: number, max: number) {
return Math.max(min, Math.min(max, n));
}

function randomHex(bytes = 20) {
// browser-safe mock hash (not cryptographic)
const arr = new Uint8Array(bytes);
if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
crypto.getRandomValues(arr);
} else {
for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
}
return `0x${Array.from(arr)
.map((b) => b.toString(16).padStart(2, '0'))
.join('')}`;
}

function buildLedgerEntry(args: {
address: string;
score: number;
daoResult: DaoSubmitResponse;
prev: LedgerEntry | null;
}): LedgerEntry {
const { address, score, daoResult, prev } = args;

const height = prev ? prev.height + 1 : 1;
const prevHash = prev ? prev.hash : null;

return {
kind: 'trust_kernel_v1',
ledgerId: `ledger_${new Date().toISOString().replace(/[-:TZ.]/g, '')}_${String(height).padStart(6, '0')}`,
height,
prevHash,
address,
score,
daoResult,
createdAt: new Date().toISOString(),
hash: randomHex(32),
};
}

function verifyMock(entry: LedgerEntry, chainPrev: LedgerEntry | null): VerifyResponse {
const hashOk = typeof entry.hash === 'string' && entry.hash.startsWith('0x') && entry.hash.length >= 10;

// chainOk: if height==1 -> prevHash must be null
// else prevHash should equal previous entry's hash
const chainOk =
entry.height === 1
? entry.prevHash === null
: !!chainPrev && entry.prevHash === chainPrev.hash && entry.height === chainPrev.height + 1;

const ok = !!hashOk && !!chainOk;

return {
ok,
valid: ok,
hashOk,
chainOk,
reason: ok ? undefined : !hashOk ? 'hash invalid (mock)' : 'chain linkage invalid (mock)',
};
}

/* =========================
UI Components
========================= */

function ScoreRing({
value,
size = 92,
stroke = 10,
}: {
value: number; // 0-100
size?: number;
stroke?: number;
}) {
const v = clamp(value, 0, 100);
const r = (size - stroke) / 2;
const c = 2 * Math.PI * r;
const dash = (v / 100) * c;

return (
<div className="relative" style={{ width: size, height: size }}>
<svg width={size} height={size} className="block">
<defs>
<linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stopColor="#34d399" />
<stop offset="55%" stopColor="#22d3ee" />
<stop offset="100%" stopColor="#60a5fa" />
</linearGradient>
</defs>

<circle
cx={size / 2}
cy={size / 2}
r={r}
stroke="rgba(255,255,255,0.10)"
strokeWidth={stroke}
fill="transparent"
/>
<circle
cx={size / 2}
cy={size / 2}
r={r}
stroke="url(#scoreGradient)"
strokeWidth={stroke}
fill="transparent"
strokeLinecap="round"
strokeDasharray={`${dash} ${c - dash}`}
transform={`rotate(-90 ${size / 2} ${size / 2})`}
/>
</svg>

<div className="absolute inset-0 flex flex-col items-center justify-center">
<div className="text-2xl font-semibold tracking-tight text-white">{v}</div>
<div className="text-[10px] uppercase tracking-widest text-white/60">Trust</div>
</div>
</div>
);
}

function StepPill({ active, label }: { active: boolean; label: string }) {
return (
<div
className={[
'px-3 py-1 rounded-full text-xs tracking-wide border',
active
? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/25'
: 'bg-white/5 text-white/55 border-white/10',
].join(' ')}
>
{label}
</div>
);
}

function JsonPanel({ title, data }: { title: string; data: unknown }) {
return (
<div className="bg-black/25 border border-white/10 rounded-xl overflow-hidden">
<div className="px-3 py-2 text-xs text-white/70 border-b border-white/10 flex items-center justify-between">
<span>{title}</span>
<span className="text-white/40">JSON</span>
</div>
<pre className="max-h-[220px] overflow-auto p-3 text-[11px] leading-relaxed text-white/85">
{typeof data === 'string' ? data : safeStringify(data)}
</pre>
</div>
);
}

/* =========================
Page
========================= */

export default function Page() {
const [mounted, setMounted] = useState(false);

const [address, setAddress] = useState<string | null>(null);
const [statusText, setStatusText] = useState<string>('Not connected');

const [score, setScore] = useState<TrustScoreResponse | null>(null);
const [daoResult, setDaoResult] = useState<DaoSubmitResponse | null>(null);

// ④⑤⑥を “DAO submit のあとにローカル生成” で必ず出す
const [ledger, setLedger] = useState<LedgerEntry | null>(null);
const [timeline, setTimeline] = useState<LedgerEntry[]>([]);
const [verify, setVerify] = useState<VerifyResponse | null>(null);

const [busy, setBusy] = useState<{ wallet?: boolean; score?: boolean; dao?: boolean; verify?: boolean }>({});

const [logs, setLogs] = useState<string[]>([]);
const addLog = (msg: string) => {
setLogs((prev) => [`[${nowStamp()}] ${msg}`, ...prev].slice(0, 80));
};

const canUseEth = useMemo(() => {
if (!mounted) return false;
return typeof window !== 'undefined' && !!window.ethereum?.request;
}, [mounted]);

const connected = !!address;

const progress = useMemo(() => {
let p = 0;
if (address) p += 20;
if (score?.ok) p += 20;
// DAO approved で進む（pending は進捗としては未完扱い）
if (daoResult?.approved) p += 20;
if (ledger?.hash) p += 20;
if (verify?.ok) p += 20;
return p;
}, [address, score, daoResult, ledger, verify]);

// --- Mount ---
useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect
setMounted(true);
}, []);

// --- silent connect + listeners ---
useEffect(() => {
if (!mounted) return;

if (!window.ethereum?.request) {
setStatusText('No wallet provider (MetaMask) detected');
addLog('No window.ethereum found.');
return;
}

const handleAccountsChanged = (accountsUnknown: unknown) => {
const accounts = Array.isArray(accountsUnknown) ? (accountsUnknown as string[]) : [];
const a = accounts?.[0] ?? null;
setAddress(a);
setStatusText(a ? 'Connected' : 'Not connected');
addLog(a ? `accountsChanged: ${a}` : 'accountsChanged: disconnected');
};

const handleChainChanged = (chainIdUnknown: unknown) => {
const chainId = typeof chainIdUnknown === 'string' ? chainIdUnknown : safeStringify(chainIdUnknown);
addLog(`chainChanged: ${chainId}`);
// demo: chain changed -> reset verify only
setVerify(null);
};

(async () => {
try {
const accountsUnknown = await window.ethereum!.request({ method: 'eth_accounts' });
const accounts = Array.isArray(accountsUnknown) ? (accountsUnknown as string[]) : [];
const a = accounts?.[0] ?? null;

setAddress(a);
setStatusText(a ? 'Connected' : 'Not connected');
addLog(a ? `eth_accounts: connected ${a}` : 'eth_accounts: none');
} catch (e) {
addLog(`eth_accounts error: ${safeStringify(e)}`);
}
})();

window.ethereum.on?.('accountsChanged', handleAccountsChanged);
window.ethereum.on?.('chainChanged', handleChainChanged);

return () => {
window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [mounted]);

/* =========================
Actions
========================= */

const resetLocalState = () => {
setScore(null);
setDaoResult(null);
setLedger(null);
setTimeline([]);
setVerify(null);
addLog('Local state reset.');
};

const connectWallet = async () => {
if (!window.ethereum?.request) {
alert('MetaMask (window.ethereum) not found.');
addLog('Connect failed: MetaMask not found.');
return;
}

setBusy((b) => ({ ...b, wallet: true }));
try {
addLog('Requesting wallet accounts (popup should appear if not already permitted)...');

// optional: permissions
try {
await window.ethereum.request({
method: 'wallet_requestPermissions',
params: [{ eth_accounts: {} }],
});
addLog('wallet_requestPermissions: ok');
} catch (e) {
addLog(`wallet_requestPermissions: skipped (${safeStringify(e)})`);
}

const accountsUnknown = await window.ethereum.request({ method: 'eth_requestAccounts' });
const accounts = Array.isArray(accountsUnknown) ? (accountsUnknown as string[]) : [];
const a = accounts?.[0] ?? null;

if (!a) {
addLog('No account returned from eth_requestAccounts.');
alert('No account selected.');
return;
}

setAddress(a);
setStatusText('Connected');
addLog(`Connected: ${a}`);

setVerify(null);
} catch (err) {
const msg =
typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : safeStringify(err);

addLog(`Connect error: ${msg}`);
alert(msg || 'Wallet connection failed');

addLog('If MetaMask popup does not appear: MetaMask → Connected sites → remove this site, then try Connect again.');
} finally {
setBusy((b) => ({ ...b, wallet: false }));
}
};

const disconnectLocal = () => {
setAddress(null);
setStatusText('Not connected');
resetLocalState();
addLog('Disconnected (local).');
};

const generateTrustScore = async () => {
if (!address) {
alert('Connect wallet first.');
return;
}

setBusy((b) => ({ ...b, score: true }));
try {
addLog('Calling /api/score ...');

const res = await fetch('/api/score', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ address }),
});

const text = await res.text();
let json: unknown = null;
try {
json = JSON.parse(text);
} catch {
// keep as text
}

if (!res.ok) {
addLog(`Score API HTTP ${res.status}: ${text}`);
alert(`Score API failed: ${res.status}`);
return;
}

const data = (json ?? {}) as TrustScoreResponse;
setScore(data);
addLog(`AI trust score ok: ${typeof data?.score === 'number' ? data.score : '—'}`);

// score 更新時は downstream を整理
setDaoResult(null);
setLedger(null);
setTimeline([]);
setVerify(null);
} catch (e) {
addLog(`Score error: ${safeStringify(e)}`);
alert('Failed to generate trust score.');
} finally {
setBusy((b) => ({ ...b, score: false }));
}
};

const submitToDao = async () => {
if (!address) {
alert('Connect wallet first.');
return;
}
if (!score?.ok || typeof score.score !== 'number') {
alert('Generate trust score first.');
return;
}

setBusy((b) => ({ ...b, dao: true }));
try {
addLog('Submitting score to DAO (mock) ...');

const res = await fetch('/api/dao/approve', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ address, score: score.score }),
});

const text = await res.text();
let json: unknown = null;
try {
json = JSON.parse(text);
} catch {
// keep as text
}

if (!res.ok) {
addLog(`DAO API HTTP ${res.status}: ${text}`);
alert(`DAO API failed: ${res.status}`);
return;
}

// 返却形式が揺れても吸収
const obj = (json && typeof json === 'object') ? (json as JsonObject) : {};

// ✅ daoResult / dao / 直返し、どれでも拾う
const dr =
  (obj.daoResult && typeof obj.daoResult === 'object' ? (obj.daoResult as DaoSubmitResponse) : null) ??
  (obj.dao && typeof obj.dao === 'object' ? (obj.dao as DaoSubmitResponse) : null) ??
  (obj as unknown as DaoSubmitResponse);


setDaoResult(dr);

// ★ここが本命：DAO submit 後に ledger/timeline/verify をローカルで生成
setTimeline((prevTimeline) => {
const prevLast = prevTimeline.length ? prevTimeline[prevTimeline.length - 1] : null;
const nextEntry = buildLedgerEntry({
address,
score: score.score!,
daoResult: dr,
prev: prevLast,
});

// ledger を最新に
setLedger(nextEntry);

// verify を“すぐ出す” (＝ 4/5/6 が必ず埋まる)
const chainPrev = prevLast;
const v = verifyMock(nextEntry, chainPrev);
setVerify(v);

return [...prevTimeline, nextEntry];
});

addLog(dr?.approved ? 'DAO status: approved (mock).' : 'DAO status: pending/denied (mock).');
addLog('Ledger entry created locally (mock).');
addLog('Verify computed locally (mock).');
} catch (e) {
addLog(`DAO error: ${safeStringify(e)}`);
alert('Failed to submit to DAO.');
} finally {
setBusy((b) => ({ ...b, dao: false }));
}
};

const verifyLedger = async () => {
const target = ledger ?? (timeline.length ? timeline[timeline.length - 1] : null);
if (!target) {
alert('No ledger entry yet. Submit to DAO first.');
return;
}

setBusy((b) => ({ ...b, verify: true }));
try {
addLog('Verifying ledger (mock, local) ...');

const chainPrev = (() => {
if (timeline.length < 2) return null;
// target は最新想定。念のため最後の一つ前を prev として扱う
return timeline[timeline.length - 2];
})();

const v = verifyMock(target, chainPrev);
setVerify(v);

addLog(v.ok ? 'Verify: OK' : `Verify: not OK (${v.reason ?? 'mock'})`);
} catch (e) {
addLog(`Verify error: ${safeStringify(e)}`);
alert('Failed to verify.');
} finally {
setBusy((b) => ({ ...b, verify: false }));
}
};

/* =========================
UI helpers
========================= */

const scoreValue = useMemo(() => {
if (!score?.ok || typeof score.score !== 'number') return null;
return clamp(score.score, 0, 100);
}, [score]);

const metaMaskTip = (
<div className="mt-2 text-xs text-white/55">
Tip: もし Disconnect → Connect で MetaMask のポップアップが出ない場合は、MetaMask で{' '}
<span className="text-white/80">「Connected sites」</span>からこのサイトを削除してから再度 Connect してください（拡張機能側の仕様）。
</div>
);

// mount 前でも “同じ UI” を出して mismatch を最小化
// ※ボタンは mounted まで disabled にしておく
const effectiveCanUseEth = mounted && canUseEth;

return (
<main className="min-h-screen w-full text-white">
{/* LP寄せ：星空 + グラデ背景 */}
<div className="fixed inset-0 -z-10">
<div className="absolute inset-0 bg-[#070B18]" />
<div className="absolute inset-0 opacity-90 bg-[radial-gradient(circle_at_25%_10%,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(52,211,153,0.14),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(96,165,250,0.14),transparent_50%)]" />
<div className="absolute inset-0 opacity-[0.18] bg-[radial-gradient(rgba(255,255,255,0.7)_1px,transparent_1px)] [background-size:28px_28px]" />
</div>

<div className="mx-auto w-full max-w-[760px] px-5 py-10">
{/* Header */}
<div className="text-center">
<div className="text-[34px] font-semibold tracking-tight">TRUST OS PoC</div>
<div className="mt-1 text-xs text-white/60">
Wallet → AI Trust Score → DAO Approval (Mock) → Trust Kernel Ledger → Verify (Mock)
</div>
</div>

{/* DEBUG LOG */}
<section className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-500/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="flex items-center justify-between px-4 py-3">
<div>
<div className="text-xs font-semibold text-emerald-200">DEBUG LOG</div>
<div className="text-[11px] text-white/50">Latest events / actions</div>
</div>
<button
onClick={() => setLogs([])}
className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
>
Clear
</button>
</div>
<div className="px-4 pb-4">
<pre className="max-h-[140px] overflow-auto rounded-xl border border-white/10 bg-black/25 p-3 text-[11px] leading-relaxed text-emerald-100/90">
{logs.length ? logs.join('\n') : '—'}
</pre>
</div>
</section>

{/* Progress + Step pills */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-4 py-3">
<div className="flex items-center justify-between">
<div className="text-xs text-white/70">
Progress: <span className="text-emerald-200 font-semibold">{progress}%</span>
</div>
<div className="text-xs text-white/50">This is a roadmap (not “unfinished”).</div>
</div>

<div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
<div
className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400"
style={{ width: `${progress}%` }}
/>
</div>

<div className="mt-3 flex flex-wrap gap-2">
<StepPill active={!!address} label="Wallet" />
<StepPill active={!!score?.ok} label="AI Score" />
<StepPill active={!!daoResult?.approved} label="DAO" />
<StepPill active={!!ledger?.hash} label="Ledger" />
<StepPill active={!!verify?.ok} label="Verify" />
</div>
</div>
</section>

{/* 1. Wallet */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="flex items-start justify-between gap-3">
<div>
<div className="text-sm font-semibold">1. Connect Wallet</div>
<div className="mt-1 text-xs text-white/55">
“Disconnect” resets app state. To revoke site-connection, do it in MetaMask.
</div>

<div className="mt-3 text-xs">
<div>
Status:{' '}
<span className={connected ? 'text-emerald-200 font-semibold' : 'text-white/60'}>{statusText}</span>
</div>
<div className="text-white/70">
Address: <span className="text-white/85">{address ?? '—'}</span>
</div>
{metaMaskTip}
</div>
</div>

<div className="flex flex-col gap-2 min-w-[180px]">
<button
onClick={connectWallet}
disabled={!effectiveCanUseEth || busy.wallet}
className={[
'rounded-xl px-4 py-2 text-sm font-semibold',
'bg-gradient-to-r from-emerald-400 to-cyan-400 text-black',
'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ')}
>
{busy.wallet ? 'Connecting…' : 'Reconnect / MetaMask'}
</button>

<button
onClick={disconnectLocal}
className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
>
Disconnect
</button>

<button
onClick={resetLocalState}
className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10"
>
Reset local state
</button>
</div>
</div>
</div>
</section>

{/* 2. Score */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="flex items-start justify-between gap-3">
<div>
<div className="text-sm font-semibold">2. AI Trust Score</div>
<div className="mt-1 text-xs text-white/55">
In production, this is computed from on-chain + off-chain signals. In this PoC, we generate a pseudo
score.
</div>
</div>

<button
onClick={generateTrustScore}
disabled={!connected || busy.score}
className="rounded-xl bg-sky-300 text-black px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
>
{busy.score ? 'Generating…' : 'Generate Trust Score'}
</button>
</div>

<div className="mt-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4 items-start">
<div className="flex flex-col items-center justify-center">
<ScoreRing value={scoreValue ?? 0} />
<div className="mt-2 text-[11px] text-white/60">
{scoreValue === null ? 'Generate to see score' : `Current score: ${scoreValue}%`}
</div>
</div>

<div className="space-y-3">
<div className="flex items-center gap-2">
<div className="text-xs text-white/70">AI score status:</div>
<div
className={[
'text-xs font-semibold',
score?.ok ? 'text-emerald-200' : score ? 'text-rose-200' : 'text-white/40',
].join(' ')}
>
{score?.ok ? 'OK' : score ? 'Not ready' : '—'}
</div>
</div>

{score?.ok && (
<div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
<div
className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400"
style={{ width: `${scoreValue ?? 0}%` }}
/>
</div>
)}

<JsonPanel title="AI Trust Score (JSON)" data={score ?? { note: 'No score yet.' }} />
</div>
</div>
</div>
</section>

{/* 3. DAO */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="flex items-start justify-between gap-3">
<div>
<div className="text-sm font-semibold">3. DAO Approval (Mock)</div>
<div className="mt-1 text-xs text-white/55">
A DAO receives the score and verifies it. Here we simulate the flow (pending → approved) without
writing to a real chain.
</div>
</div>

<button
onClick={submitToDao}
disabled={!connected || !score?.ok || busy.dao}
className="rounded-xl bg-emerald-200/60 text-black px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
>
{busy.dao ? 'Submitting…' : 'Submit to DAO'}
</button>
</div>

{daoResult && (
<div className="mt-4">
<div
className={[
'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
daoResult.approved
? 'border-emerald-300/25 bg-emerald-400/15 text-emerald-200'
: 'border-yellow-300/25 bg-yellow-400/10 text-yellow-200',
].join(' ')}
>
<span>DAO Result:</span>
<span>{daoResult.approved ? 'VERIFIED' : 'PENDING'}</span>
</div>
</div>
)}

<div className="mt-3">
<JsonPanel
title="DAO Result (JSON)"
data={daoResult ?? { note: 'No DAO submission yet. Generate score, then submit.' }}
/>
</div>
</div>
</section>

{/* 4. Ledger */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="text-sm font-semibold">4. Trust Kernel Ledger</div>
<div className="mt-1 text-xs text-white/55">Latest ledger entry (JSON).</div>

<div className="mt-3">
<JsonPanel
title="Trust Kernel Ledger (JSON)"
data={ledger ?? { note: 'No ledger yet. Submit to DAO to create a ledger entry.' }}
/>
</div>
</div>
</section>

{/* 5. Timeline */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="text-sm font-semibold">5. Ledger Timeline (Latest)</div>
<div className="mt-1 text-xs text-white/55">Recent entries for this demo session.</div>

<div className="mt-3">
<JsonPanel title="Ledger Timeline (JSON)" data={timeline.length ? timeline : { note: 'No timeline yet.' }} />
</div>
</div>
</section>

{/* 6. Verify */}
<section className="mt-4 rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
<div className="px-5 py-4">
<div className="flex items-start justify-between gap-3">
<div>
<div className="text-sm font-semibold">6. Verify</div>
<div className="mt-1 text-xs text-white/55">
Mock verification. In production this becomes full on-chain / signature verification.
</div>
</div>

<button
onClick={verifyLedger}
disabled={busy.verify || (!ledger && !timeline.length)}
className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
>
{busy.verify ? 'Verifying…' : 'Verify Ledger'}
</button>
</div>

{verify && !verify.ok && (
<p className="mt-3 text-yellow-200 text-xs">
Verify (mock): pending full on-chain / signature verification — this is a roadmap step, not “unfinished”.
</p>
)}

{verify && verify.ok && <p className="mt-3 text-emerald-200 text-xs font-semibold">Verify: OK</p>}

<div className="mt-3">
<JsonPanel title="Verify Result (JSON)" data={verify ?? { note: 'No verification yet.' }} />
</div>
</div>
</section>

<div className="mt-6 text-center text-[11px] text-white/45">
Trust OS PoC — LP-like UI for investor demos (FINOLAB / VC / technical reviewers)
</div>
</div>
</main>
);
}

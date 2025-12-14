'use client';

import { useEffect, useMemo, useState } from 'react';

type DaoResult = {
  approved: boolean;
  yes: number;
  no: number;
  quorum: number;
  txHash?: string;
};

type LedgerEntry = {
  kind: string;
  ledgerId: string;
  height: number;
  prevHash: string | null;
  address: string;
  score: number;
  daoResult: DaoResult;
  createdAt: string;
  hash: string;
};

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [daoResult, setDaoResult] = useState<DaoResult | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry | null>(null);
  const [timeline, setTimeline] = useState<LedgerEntry[]>([]);
  const [verifyOk, setVerifyOk] = useState<boolean | null>(null);

  /* ------------------ hydration safety ------------------ */
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  /* ------------------ wallet ------------------ */
  const connectWallet = async () => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        alert('MetaMask not found');
        return;
      }
      const accounts = await eth.request({
        method: 'eth_requestAccounts',
      });
      setAddress(accounts?.[0] ?? null);
    } catch (e) {
      console.error(e);
      alert('Wallet connection failed');
    }
  };

  const disconnect = () => {
    setAddress(null);
    setScore(null);
    setDaoResult(null);
    setLedger(null);
    setVerifyOk(null);
  };

  /* ------------------ AI score ------------------ */
  const generateScore = () => {
    const s = 60 + Math.floor(Math.random() * 15);
    setScore(s);
  };

  /* ------------------ DAO ------------------ */
  const submitDao = () => {
    if (score == null || !address) return;
    const dao: DaoResult = {
      approved: true,
      yes: 70,
      no: 30,
      quorum: 60,
      txHash: '0xMOCK',
    };
    setDaoResult(dao);

    const entry: LedgerEntry = {
      kind: 'trust_kernel_v1',
      ledgerId: `ledger_${Date.now()}`,
      height: timeline.length + 1,
      prevHash: timeline.at(-1)?.hash ?? null,
      address,
      score,
      daoResult: dao,
      createdAt: new Date().toISOString(),
      hash: `0x${Math.random().toString(16).slice(2)}`,
    };

    setLedger(entry);
    setTimeline((t) => [entry, ...t]);
  };

  /* ------------------ verify ------------------ */
  const verify = () => {
    setVerifyOk(!!ledger);
  };

  /* ------------------ score ring ------------------ */
  const ring = useMemo(() => {
    if (score == null) return 0;
    return Math.min(100, Math.max(0, score));
  }, [score]);

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      {/* background */}
      <div className="absolute inset-0 bg-[#050A16]" />
      <div className="absolute inset-0 opacity-95 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.16),transparent_42%),radial-gradient(circle_at_80%_28%,rgba(96,165,250,0.14),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(167,139,250,0.10),transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-[920px] px-6 py-14 [transform:scale(1.05)] origin-top">
        {/* header */}
        <h1 className="text-center text-[42px] font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-200 drop-shadow-[0_0_18px_rgba(34,211,238,0.18)]">
          TRUST OS PoC
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Wallet → AI Trust Score → DAO Approval → Ledger → Verify
        </p>

        {/* 1 wallet */}
        <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">1. Connect Wallet</h2>
          <div className="mt-3 flex gap-3">
            <button
              onClick={connectWallet}
              className="rounded-lg bg-cyan-400 px-4 py-2 font-medium text-black"
            >
              Connect / MetaMask
            </button>
            <button
              onClick={disconnect}
              className="rounded-lg bg-white/10 px-4 py-2"
            >
              Disconnect
            </button>
          </div>
          {address && (
            <div className="mt-3 text-sm text-slate-300">
              Connected: {address}
            </div>
          )}
        </section>

        {/* 2 score */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">2. AI Trust Score</h2>
          <button
            onClick={generateScore}
            className="mt-3 rounded-lg bg-sky-400 px-4 py-2 font-medium text-black"
          >
            Generate Trust Score
          </button>

          {score != null && (
            <div className="mt-6 flex items-center gap-6">
              <svg width="120" height="120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="url(#grad)"
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${ring * 3.14} 314`}
                  transform="rotate(-90 60 60)"
                />
                <defs>
                  <linearGradient id="grad">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="55%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                <text
                  x="60"
                  y="68"
                  textAnchor="middle"
                  fontSize="26"
                  fill="white"
                >
                  {score}
                </text>
              </svg>
              <div className="text-lg">Trust Score</div>
            </div>
          )}
        </section>

        {/* 3 dao */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">3. DAO Approval (Mock)</h2>
          <button
            onClick={submitDao}
            disabled={score == null}
            className="mt-3 rounded-lg bg-emerald-400 px-4 py-2 font-medium text-black disabled:opacity-40"
          >
            Submit to DAO
          </button>
          {daoResult && (
            <div className="mt-3 font-semibold text-emerald-300">
              DAO Result: VERIFIED
            </div>
          )}
        </section>

        {/* 4 ledger */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">4. Trust Kernel Ledger</h2>
          {ledger ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded bg-black/40 p-3 text-xs">
              {JSON.stringify(ledger, null, 2)}
            </pre>
          ) : (
            <p className="mt-2 text-sm text-slate-400">No ledger yet.</p>
          )}
        </section>

        {/* 5 timeline */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">5. Ledger Timeline</h2>
          <pre className="mt-3 max-h-56 overflow-auto rounded bg-black/40 p-3 text-xs">
            {JSON.stringify(timeline, null, 2)}
          </pre>
        </section>

        {/* 6 verify */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">6. Verify</h2>
          <button
            onClick={verify}
            className="mt-3 rounded-lg bg-white/10 px-4 py-2"
          >
            Verify Ledger
          </button>
          {verifyOk === false && (
            <p className="mt-2 text-yellow-400">
              Verify (mock): pending full on-chain verification
            </p>
          )}
          {verifyOk === true && (
            <p className="mt-2 font-semibold text-emerald-300">Verify: OK</p>
          )}
        </section>
      </div>
    </main>
  );
}

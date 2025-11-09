'use client';

import { injected } from 'wagmi/connectors';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

const Btn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    style={{
      background:'#28E0AE', color:'#0D1521', border:'none',
      padding:'10px 16px', borderRadius:8, cursor:'pointer'
    }}
  />
);

const BtnGhost = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...props}
    style={{
      background:'transparent', color:'#fff',
      border:'1px solid #8CA3B5', padding:'8px 14px',
      borderRadius:8, cursor:'pointer'
    }}
  />
);

export default function Home() {
  // Wallet
  const { connect } = useConnect({ connector: injected() });
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  // States
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const [daoLoading, setDaoLoading] = useState(false);
  const [dao, setDao] = useState<null | {
    approved: boolean;
    txHash: string;
    yes: number; no: number; quorum: number;
  }>(null);

  // UI helpers
  const Btn = (props: any) => (
    <button
      {...props}
      style={{
        background:'#28E0AE', color:'#0D1521', border:'none',
        padding:'10px 16px', borderRadius:8, cursor:'pointer'
      }}
    />
  );
  const BtnGhost = (props: any) => (
    <button
      {...props}
      style={{
        background:'transparent', color:'#fff',
        border:'1px solid #8CA3B5', padding:'8px 14px',
        borderRadius:8, cursor:'pointer'
      }}
    />
  );
  const Tag = ({ok}:{ok:boolean}) => (
    <span style={{
      padding:'4px 8px', borderRadius:999,
      background: ok ? '#28E0AE' : '#FF6B6B',
      color: ok ? '#0D1521' : '#1B0B0B', fontWeight:700
    }}>
      {ok ? 'Verified' : 'Rejected'}
    </span>
  );

  // API: Score
  const generateScore = async () => {
    setLoading(true);
    setMsg('Generating trust score…');
    setDao(null); // 前回のDAO結果をリセット
    try {
      const res = await fetch('/api/score', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      setScore(data.score);
      setMsg('Done.');
    } catch (e) {
      setMsg('Error generating score');
    } finally {
      setLoading(false);
    }
  };

  // API: DAO Approve
  const approveDao = async () => {
    if (score == null) return alert('先にスコアを生成してください');
    setDaoLoading(true);
    setDao(null);
    try {
      const res = await fetch('/api/dao/approve', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ address, score }),
      });
      const data = await res.json();
      setDao({
        approved: !!data.approved,
        txHash: data.txHash || '',
        yes: data.votes?.yes ?? 0,
        no: data.votes?.no ?? 0,
        quorum: data.votes?.quorum ?? 0,
      });
    } finally {
      setDaoLoading(false);
    }
  };

  // Render
  return (
    <main
      style={{
        minHeight:'100vh', background:'#0D1521', color:'#fff',
        display:'grid', placeItems:'center', fontFamily:'Inter, Noto Sans JP, sans-serif'
      }}
    >
      <div style={{textAlign:'center', maxWidth:720, width:'100%', padding:16}}>
        <h1 style={{marginBottom:16}}>TRUST OS PoC</h1>

        {!isConnected ? (
          <>
            <p style={{opacity:.8, marginBottom:12}}>
              Connect your wallet / ウォレットを接続
            </p>
            <Btn onClick={() => connect()}>Connect Wallet</Btn>
            <p style={{fontSize:12, opacity:.6, marginTop:10}}>
              ※ MetaMaskは後からでもOK。未接続でもスコア生成は動作します。
            </p>
          </>
        ) : (
          <>
            <p style={{margin:'12px 0'}}>Connected: {address?.slice(0,6)}…{address?.slice(-4)}</p>
            <BtnGhost onClick={() => disconnect()}>Disconnect</BtnGhost>
          </>
        )}

        {/* Score Block */}
        <div style={{marginTop:24, padding:16, border:'1px solid #1E3247', borderRadius:12, background:'#0F1D2B'}}>
          <h2 style={{marginTop:0}}>AI Analysis → Trust Score</h2>
          <Btn onClick={generateScore} disabled={loading} style={{marginTop:8}}>
            {loading ? 'Generating…' : 'Generate Trust Score'}
          </Btn>
          {msg && <p style={{opacity:.8, marginTop:8, marginBottom:0}}>{msg}</p>}
          {score !== null && (
            <div style={{marginTop:12, padding:'10px 12px', border:'1px solid #1E4153', borderRadius:12, background:'#0B2430'}}>
              <strong>Trust Score:</strong> {score} / 100
            </div>
          )}
        </div>

        {/* DAO Approve Block */}
        <div style={{marginTop:24, padding:16, border:'1px solid #1E3247', borderRadius:12, background:'#0F1D2B'}}>
          <h2 style={{marginTop:0}}>DAO Approval (Mock)</h2>
          <p style={{opacity:.8, margin:'6px 0'}}>
            Community votes to verify your trust score / DAO投票でスコア承認
          </p>

          <button
            onClick={approveDao}
            disabled={daoLoading || score==null}
            style={{
              background:'#8BD3FF', color:'#00203F', border:'none',
              padding:'10px 16px', borderRadius:8, cursor:'pointer'
            }}
          >
            {daoLoading ? 'Voting… / 投票中…' : 'Submit to DAO / 承認申請'}
          </button>

          {dao && (
            <div style={{marginTop:12, padding:'10px 12px', border:'1px solid #1E4153', borderRadius:12, background:'#0B2430', textAlign:'left'}}>
              <div style={{display:'flex', gap:8, alignItems:'center', justifyContent:'space-between'}}>
                <div>
                  <div><strong>Result:</strong> <Tag ok={dao.approved} /></div>
                  <div style={{marginTop:6, fontSize:13, opacity:.9}}>
                    <div>Votes: YES {dao.yes} / NO {dao.no} (Quorum {dao.quorum})</div>
                    <div style={{marginTop:2}}>Tx: <code style={{fontSize:12}}>{dao.txHash.slice(0,18)}…</code></div>
                  </div>
                </div>
                <div style={{minWidth:160, textAlign:'center'}}>
                  <div style={{height:10, background:'#133247', borderRadius:999, overflow:'hidden'}}>
                    <div style={{
                      width: `${Math.min(100, Math.round(dao.yes/(dao.yes+dao.no)*100))}%`,
                      height:'100%', background:'#28E0AE'
                    }}/>
                  </div>
                  <div style={{fontSize:12, opacity:.7, marginTop:4}}>
                    Yes ratio
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

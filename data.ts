'use client';
import { useEffect, useMemo, useState } from 'react';
import { adminUser, fixtures as defaultFixtures, players as defaultPlayers, prizes, scorePrediction, type Fixture, type Player, type Prediction } from '@/lib/data';

type User = { role:'admin'|'player'; username:string; playerId?:number; name:string } | null;
const rounds = ['Last 16','Quarter Final','Semi Final','Final'] as const;

function getStore<T>(key:string, fallback:T):T{ if(typeof window==='undefined') return fallback; try{const v=localStorage.getItem(key); return v?JSON.parse(v):fallback;}catch{return fallback;} }
function setStore(key:string, value:any){ if(typeof window!=='undefined') localStorage.setItem(key, JSON.stringify(value)); }

export default function App(){
  const [user,setUser]=useState<User>(null);
  const [players,setPlayers]=useState<Player[]>(defaultPlayers);
  const [fixtures,setFixtures]=useState<Fixture[]>(defaultFixtures);
  const [preds,setPreds]=useState<Record<string,Record<string,Prediction>>>({});
  const [screen,setScreen]=useState<'home'|'login'|'predictions'|'leaderboard'|'admin'|'stats'|'prizes'>('home');
  const [login,setLogin]=useState({username:'',password:''});
  const [round,setRound]=useState<typeof rounds[number]>('Last 16');

  useEffect(()=>{setPlayers(getStore('wckp_players',defaultPlayers));setFixtures(getStore('wckp_fixtures',defaultFixtures));setPreds(getStore('wckp_preds',{}));setUser(getStore('wckp_user',null));},[]);
  useEffect(()=>setStore('wckp_players',players),[players]);
  useEffect(()=>setStore('wckp_fixtures',fixtures),[fixtures]);
  useEffect(()=>setStore('wckp_preds',preds),[preds]);
  useEffect(()=>setStore('wckp_user',user),[user]);

  const leaderboard = useMemo(()=> players.map(p=>{
    const list = Object.values(preds[p.id]||{}); let points=0, exact=0, correct=0, zero=0, jokerPoints=0;
    for(const pr of list){ const res=scorePrediction(pr, fixtures.find(f=>f.id===pr.fixtureId)); points+=res.points; exact+=res.exact; correct+=res.correct; zero+=res.zero; jokerPoints+=res.jokerPoints; }
    return {...p, points, exact, correct, zero, jokerPoints, submitted:list.length};
  }).sort((a,b)=> b.points-a.points || b.exact-a.exact || a.name.localeCompare(b.name)),[players,preds,fixtures]);

  const currentPlayer = user?.role==='player' ? players.find(p=>p.id===user.playerId) : undefined;
  const paidCount = players.filter(p=>p.paid).length;

  function doLogin(){
    const u=login.username.trim().toLowerCase();
    if(u===adminUser.username && login.password===adminUser.password){setUser({role:'admin',username:u,name:'Admin'});setScreen('admin');return;}
    const p=players.find(x=>x.username.toLowerCase()===u && x.password===login.password);
    if(p){setUser({role:'player',username:u,playerId:p.id,name:p.name});setScreen('predictions');return;}
    alert('Login not recognised');
  }
  function logout(){setUser(null);setScreen('home');}

  function savePrediction(f:Fixture, home:string, away:string, joker:boolean){
    if(!currentPlayer) return;
    const playerPreds={...(preds[currentPlayer.id]||{})};
    if(joker){ for(const id of Object.keys(playerPreds)){ const fix=fixtures.find(x=>x.id===id); if(fix?.round===f.round) playerPreds[id]={...playerPreds[id], joker:false}; }}
    playerPreds[f.id]={fixtureId:f.id,home,away,joker};
    setPreds({...preds,[currentPlayer.id]:playerPreds});
  }

  function updateScore(id:string, key:'homeScore'|'awayScore', val:string){ setFixtures(fixtures.map(f=>f.id===id?{...f,[key]:val===''?null:Number(val)}:f)); }
  function updatePlayer(id:number, key:keyof Player, val:any){ setPlayers(players.map(p=>p.id===id?{...p,[key]:val}:p)); }

  return <main className="container">
    <nav className="nav"><div className="brand">🏆 World Cup Knockout Predictor RT</div><div className="btns" style={{margin:0}}><button className="secondary" onClick={()=>setScreen('home')}>Home</button><button className="secondary" onClick={()=>setScreen('leaderboard')}>Leaderboard</button><button className="secondary" onClick={()=>setScreen('prizes')}>Prizes</button>{user?<><button onClick={()=>setScreen(user.role==='admin'?'admin':'predictions')}>{user.role==='admin'?'Admin':'Predictions'}</button><button className="secondary" onClick={logout}>Logout</button></>:<button onClick={()=>setScreen('login')}>Login</button>}</div></nav>

    {screen==='home'&&<><section className="hero"><div className="card"><p className="pill" style={{display:'inline-block'}}>Saturday launch MVP</p><h1>Predict the <span className="gold">knockout rounds</span>.</h1><p className="muted">Last 16 to Final. One joker per round. Wrong 0, result 2, exact 4, 0-0 exact 5. Joker doubles the selected fixture.</p><div className="btns"><button onClick={()=>setScreen('login')}>Player Login</button><button className="secondary" onClick={()=>setScreen('leaderboard')}>View Leaderboard</button></div><div className="grid"><div className="stat"><strong>£750</strong><span className="muted">Prize pot</span></div><div className="stat"><strong>50</strong><span className="muted">Players</span></div><div className="stat"><strong>Top 10</strong><span className="muted">Paid places</span></div><div className="stat"><strong>{paidCount}/50</strong><span className="muted">Paid</span></div></div></div><Rules /></section><Fixtures fixtures={fixtures}/></>}

    {screen==='login'&&<section className="card" style={{maxWidth:520,margin:'30px auto'}}><h2>Login</h2><p className="muted">Admin: admin / rt2026. Players: player1 / wc2026-01 etc.</p><label>Username</label><input value={login.username} onChange={e=>setLogin({...login,username:e.target.value})}/><br/><br/><label>Password</label><input type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})}/><div className="btns"><button onClick={doLogin}>Login</button></div></section>}

    {screen==='predictions'&& currentPlayer && <section className="card"><h2>My Predictions - {currentPlayer.name}</h2><div className="tabs">{rounds.map(r=><button key={r} className={round===r?'':'secondary'} onClick={()=>setRound(r)}>{r}</button>)}</div>{fixtures.filter(f=>f.round===round).map(f=>{const pr=preds[currentPlayer.id]?.[f.id]||{home:'',away:'',joker:false,fixtureId:f.id};return <div className="row" key={f.id}><div className="match"><strong>{f.home} v {f.away}</strong><br/><span className="muted">{f.date} {f.time} · locks {f.lock}</span></div><div><label>Home</label><input type="number" min="0" value={pr.home} onChange={e=>savePrediction(f,e.target.value,pr.away,pr.joker)}/></div><div><label>Away</label><input type="number" min="0" value={pr.away} onChange={e=>savePrediction(f,pr.home,e.target.value,pr.joker)}/></div><div><label>Joker</label><button className={pr.joker?'':'secondary'} onClick={()=>savePrediction(f,pr.home,pr.away,!pr.joker)}>{pr.joker?'🃏 Yes':'No'}</button></div></div>})}<PlayerStats player={currentPlayer} board={leaderboard} preds={preds[currentPlayer.id]||{}} fixtures={fixtures}/></section>}

    {screen==='leaderboard'&&<Leaderboard board={leaderboard}/>} {screen==='prizes'&&<Prizes/>}

    {screen==='admin'&& user?.role==='admin'&&<section className="two"><div className="card"><h2>Admin - Results</h2>{fixtures.map(f=><div className="row" key={f.id}><div className="match"><strong>{f.id}: {f.home} v {f.away}</strong><br/><span className="muted">{f.round}</span></div><div><label>Home</label><input type="number" value={f.homeScore ?? ''} onChange={e=>updateScore(f.id,'homeScore',e.target.value)}/></div><div><label>Away</label><input type="number" value={f.awayScore ?? ''} onChange={e=>updateScore(f.id,'awayScore',e.target.value)}/></div><div><label>Status</label><div className="pill">{f.homeScore!=null&&f.awayScore!=null?'Scored':'Open'}</div></div></div>)}</div><div className="card"><h2>Players / Paid</h2><table className="table"><thead><tr><th>Name</th><th>User</th><th>Paid</th></tr></thead><tbody>{players.map(p=><tr key={p.id}><td><input value={p.name} onChange={e=>updatePlayer(p.id,'name',e.target.value)}/></td><td>{p.username}<br/><span className="muted">{p.password}</span></td><td><button className={p.paid?'':'secondary'} onClick={()=>updatePlayer(p.id,'paid',!p.paid)}>{p.paid?'Yes':'No'}</button></td></tr>)}</tbody></table></div></section>}
  </main>
}
function Rules(){return <div className="card"><h2>Rules</h2>{[['Wrong','0 pts'],['Correct result','2 pts'],['Exact score','4 pts'],['Correct 0-0','5 pts'],['Joker','Double']].map(x=><div className="roundBox" key={x[0]}><span>{x[0]}</span><strong style={{float:'right'}}>{x[1]}</strong></div>)}</div>}
function Fixtures({fixtures}:{fixtures:Fixture[]}){return <section className="card" style={{marginTop:18}}><h2>Fixtures</h2><table className="table"><thead><tr><th>Round</th><th>Match</th><th>Home</th><th>Away</th><th>Date</th><th>Time</th></tr></thead><tbody>{fixtures.map(f=><tr key={f.id}><td>{f.round}</td><td>{f.id}</td><td>{f.home}</td><td>{f.away}</td><td>{f.date}</td><td>{f.time}</td></tr>)}</tbody></table></section>}
function Leaderboard({board}:{board:any[]}){return <section className="card"><h2>Leaderboard</h2><table className="table"><thead><tr><th>Rank</th><th>Player</th><th>Pts</th><th>Exact</th><th>Result</th><th>0-0</th><th>Joker Pts</th><th>Paid</th></tr></thead><tbody>{board.map((p,i)=><tr key={p.id}><td>{i+1}</td><td>{p.name}</td><td><strong>{p.points}</strong></td><td>{p.exact}</td><td>{p.correct}</td><td>{p.zero}</td><td>{p.jokerPoints}</td><td>{p.paid?'✅':'❌'}</td></tr>)}</tbody></table></section>}
function Prizes(){return <section className="card"><h2>Prize Split - £750</h2><table className="table"><tbody>{prizes.map(([p,a])=><tr key={p}><td>{p}</td><td><strong>{a}</strong></td></tr>)}</tbody></table></section>}
function PlayerStats({player,board,preds,fixtures}:{player:Player;board:any[];preds:Record<string,Prediction>;fixtures:Fixture[]}){const rank=board.findIndex(p=>p.id===player.id)+1;const me=board.find(p=>p.id===player.id);return <div className="card" style={{marginTop:18}}><h2>My Stats</h2><div className="grid"><div className="stat"><strong>{rank||'-'}</strong><span className="muted">Rank</span></div><div className="stat"><strong>{me?.points||0}</strong><span className="muted">Points</span></div><div className="stat"><strong>{me?.exact||0}</strong><span className="muted">Exact</span></div><div className="stat"><strong>{Object.keys(preds).length}/{fixtures.length}</strong><span className="muted">Submitted</span></div></div></div>}

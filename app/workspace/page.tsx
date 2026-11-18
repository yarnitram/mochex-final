import Link from 'next/link';
import { redirect } from 'next/navigation';
import { viewer } from '../../src/server/session';
import { database,withOwner } from '../../src/server/store';
export const dynamic='force-dynamic';
const views={overview:'Overview',inbox:'Setup inbox',journal:'Trade journal',settings:'Workspace settings'} as const;
export default async function Workspace({searchParams}:{searchParams:Promise<{view?:string}>}){
 const account=await viewer();if(!account)redirect('/login');
 const {view:requested}=await searchParams;
 const view=requested&&requested in views?requested as keyof typeof views:'overview';
 const items=await withOwner(database(),account.id,c=>c.query('SELECT id,title FROM workspace_items ORDER BY title'));
 return <div className="terminal"><aside className="sidebar">
  <Link href="/workspace" className="brand">m<span>◈</span>chex<small>TERMINAL</small></Link>
  <p className="nav-label">WORKSPACE</p><nav aria-label="Workspace">{Object.entries(views).map(([key,label],i)=>
   <Link key={key} href={'/workspace?view='+key} aria-current={view===key?'page':undefined}><span className="nav-icon">{['▦','⌁','▤','⚙'][i]}</span>{label}</Link>)}</nav>
  <div className="sidebar-bottom"><span className="pilot-badge">PRIVATE PILOT</span><p>Analysis &amp; paper workflows</p><small>Exchange execution is unavailable.</small></div>
 </aside><div className="main-area"><header className="topbar"><span>Workspace <b>/</b> {views[view]}</span><div className="account"><span>{account.email}</span><form action="/api/auth/logout" method="post"><button type="submit">Sign out</button></form></div></header>
 <main className="workspace"><div className="workspace-title"><div><p className="eyebrow">MOCHEX TERMINAL</p><h1>{view==='overview'?'Your market workspace':views[view]}</h1><p className="muted">{view==='overview'?'A connected view of your research, setups and reviews.':'Your private workspace. More capabilities are coming in the next integration slices.'}</p></div><span className="status"><i/> Workspace online</span></div>
 <div className="metrics"><article><span>Connected scanners</span><strong>0</strong><small>Connect your first data source</small></article><article><span>Active setups</span><strong>0</strong><small>Scanner integration pending</small></article><article><span>Journal entries</span><strong>0</strong><small>Paper trade recording pending</small></article></div>
 <div className="content-grid"><section className="panel"><div className="panel-heading"><h2>{view==='journal'?'Trade journal':'Setup inbox'}</h2><span className="pill">0 ITEMS</span></div><div className="empty-state"><div className="empty-icon">⌁</div><h3>{view==='journal'?'Your trade reviews start here':'Your next setup starts here'}</h3><p>{view==='journal'?'Trade recording and partial-exit journaling will arrive in the next integration slices.':'No scanner is connected yet. Once connected, new setups will appear here with their market and strategy context.'}</p><span className="subtle-tag">Integration pending</span></div></section>
 <section className="panel roadmap"><p className="eyebrow">WORKSPACE PROGRESS</p><h2>A foundation for the full workflow</h2><ol><li className="done"><span>✓</span><div><b>Private workspace</b><small>Account access and isolated records</small></div></li><li><span>02</span><div><b>Signals &amp; charts</b><small>Next: scanner ingestion and chart context</small></div></li><li><span>03</span><div><b>Record &amp; review</b><small>Next: paper fills and a consistent journal</small></div></li></ol></section></div>
 <section className="panel saved"><div className="panel-heading"><h2>Saved workspaces</h2><span className="muted">Private to this account</span></div>{items.rows.length?<ul>{items.rows.map(item=><li key={item.id}><span className="saved-symbol">▦</span><span>{item.title}</span><small>PRIVATE</small></li>)}</ul>:<p className="muted">No saved workspaces yet.</p>}</section>
 <footer>Market analysis workspace <span>Foundation preview · No live trading</span></footer></main></div></div>;
}

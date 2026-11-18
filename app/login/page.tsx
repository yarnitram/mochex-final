export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const {error}=await searchParams;
 return <main className="login-page"><section className="login-intro">
  <a className="brand" href="/">m<span>◈</span>chex <small>TERMINAL</small></a>
  <p className="eyebrow">ONE WORKSPACE. EVERY STEP.</p>
  <h1>From market context<br/>to a clearer decision.</h1>
  <p className="intro-copy">Bring your research, setups and trade reviews together in a private workspace.</p>
  <div className="workflow"><span>Discover</span><b>→</b><span>Analyze</span><b>→</b><span>Review</span></div>
  <div className="foundation"><i/> Private pilot · Workspace foundation</div>
 </section><section className="login-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your terminal</h2>
  <p className="muted">Use your provisioned private account.</p>
  {error&&<p className="error" role="alert">Unable to sign in. Check your details or try again later.</p>}
  <form action="/api/auth/login" method="post">
   <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} required/>
   <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required/>
   <button className="primary" type="submit">Sign in <span aria-hidden="true">↗</span></button>
  </form><p className="login-footnote">Access is private. Ask your administrator to provision an account.</p>
 </section></main>;
}

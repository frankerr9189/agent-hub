// frontend/src/pages/Home.jsx
import { Link } from "react-router-dom";

export default function Home(){
  return (
    <>
      <Hero />
      <section>
        <div className="container">
          <h2 className="section-title">Why teams use Agent Hub</h2>
          <div className="grid">
            <Feature title="Inline highlights" copy="Sticky notes on the exact text that needs attention." />
            <Feature title="One-page summary" copy="Every issue on one compact summary page for quick review." />
            <Feature title="Brand rules" copy="Built-in policy for Bristol Myers Squibb; configurable later." />
            <Feature title="Privacy first" copy="Ephemeral processing by default; no training on your data." />
          </div>
        </div>
      </section>
    </>
  );
}

function Hero(){
  return (
    <section style={{paddingTop:64, paddingBottom:32}}>
      <div className="container" style={{textAlign:"center"}}>
      

        <h1 className="h1-gradient" style={{marginTop:16}}>
          The fastest way to<br/>launch your AI SaaS
        </h1>

        <p className="hero-sub">
          SaaS AI: The only starter kit tailored for AI web-apps. Designed to streamline your development process,
          <span className="green"> it eliminates weeks of work</span>, empowering you to
          concentrate on delivering the features that <span className="accent">matter most</span>.
        </p>

        <div style={{marginTop:18}}>
          <Link className="btn btn-primary" to="/agents">Explore AI Agents</Link>
        </div>

        <div style={{marginTop:22}} className="avatars">
          <div className="stack" title="Recent users">
            <div className="avatar" />
            <div className="avatar" />
            <div className="avatar" />
            <div className="avatar" />
            <div className="avatar" />
          </div>
          <div className="rating" title="Average rating">
            <span>★★★★★</span>
          </div>
        </div>

        <div style={{marginTop:28}} className="tech-row">
          <div className="tech">Next</div>
          <div className="tech">Vercel</div>
          <div className="tech">OpenAI</div>
          <div className="tech">TypeScript</div>
          <div className="tech">Stripe</div>
          <div className="tech">React</div>
          <div className="tech">Tailwind</div>
          <div className="tech">Postgres</div>
          <div className="tech">JS</div>
        </div>
      </div>
    </section>
  );
}

function Feature({ title, copy }){
  return (
    <div className="card">
      <h3 style={{margin:"0 0 6px", color:"#fff"}}>{title}</h3>
      <p className="subtle" style={{margin:0}}>{copy}</p>
    </div>
  );
}

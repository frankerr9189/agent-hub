import AgentCard from "../components/AgentCard.jsx";

export default function Agents(){
  return (
    <section style={{paddingTop:8}}>
      <h1 style={{fontSize:24, margin:"0 0 6px", color:"#fff"}}>AI Agents</h1>
      <p style={{marginTop:0, color:"var(--muted)"}}>Pick an agent to try.</p>
      <div className="grid" style={{marginTop:12}}>
        <AgentCard
          emoji="📝"
          title="PDF Proofreader"
          copy="Upload a PDF and get an annotated version plus a one-page summary."
          to="/agents/proofreader"
        />
        {/* Add more AgentCard entries here as you build them */}
      </div>
    </section>
  );
}

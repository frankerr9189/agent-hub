import { Link, NavLink } from "react-router-dom";

export default function SiteHeader(){
  return (
    <div className="header">
      <div className="container">
        <div className="glass header-inner" style={{padding:6}}>
          <Link to="/" className="header-brand">SaaS AI</Link>
          <nav className="header-nav">
            <NavLink className="header-link" to="/agents">AI Agents</NavLink>
            <NavLink className="header-link" to="/pricing">Pricing</NavLink>
            <NavLink className="header-link" to="/faq">FAQ</NavLink>
            <NavLink className="header-link" to="/contact">Contact</NavLink>
          </nav>
        </div>
      </div>
    </div>
  );
}

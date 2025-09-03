// frontend/src/components/SiteFooter.jsx
export default function SiteFooter(){
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Agent Hub</span>
        <span>We don’t train on your data. Files processed ephemerally.</span>
      </div>
    </footer>
  );
}

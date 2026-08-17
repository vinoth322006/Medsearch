export function AppFooter() {
  return (
    <footer className="pm-footer" role="contentinfo">
      <div className="pm-footer__inner">
        <nav className="pm-footer__links" aria-label="Footer navigation">
          <a href="#">About MedSearch</a>
          <span className="pm-footer__sep">|</span>
          <a href="#">Privacy Policy</a>
          <span className="pm-footer__sep">|</span>
          <a href="#">Terms of Service</a>
          <span className="pm-footer__sep">|</span>
          <a href="#">Contact Us</a>
        </nav>
        <p className="pm-footer__copy">
          MedSearch Semantic Search Platform
          <br />
          Built by independent developers. Not affiliated with NIH or NLM.
        </p>
      </div>
    </footer>
  );
}

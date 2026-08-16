export function AppFooter() {
  return (
    <footer className="pm-footer" role="contentinfo">
      <div className="pm-footer__inner">
        <nav className="pm-footer__links" aria-label="Footer navigation">
          <a href="https://www.nlm.nih.gov/" target="_blank" rel="noopener noreferrer">NLM</a>
          <span className="pm-footer__sep">|</span>
          <a href="https://www.nih.gov/" target="_blank" rel="noopener noreferrer">NIH</a>
          <span className="pm-footer__sep">|</span>
          <a href="https://www.hhs.gov/" target="_blank" rel="noopener noreferrer">HHS</a>
          <span className="pm-footer__sep">|</span>
          <a href="https://www.usa.gov/" target="_blank" rel="noopener noreferrer">USA.gov</a>
        </nav>
        <p className="pm-footer__copy">
          National Center for Biotechnology Information, U.S. National Library of Medicine
          <br />
          8600 Rockville Pike, Bethesda MD, 20894 USA
        </p>
      </div>
    </footer>
  );
}

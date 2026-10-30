import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "History of Game of the Generals | SLPKN PH",
  description:
    "Learn about the Filipino origins of Game of the Generals and its creator, Sofronio “Ronnie” Pasola.",
};

const sources = [
  {
    title: "The Game of the Generals’ Story",
    detail: "A first-person retrospective attributed to Sofronio Pasola, identified as a Times Journal article from April 21, 1976; reprinted online.",
    href: "https://ggsalpakan.weebly.com/history.html",
  },
  {
    title: "“Tes Pasola used her talent to help many others”",
    detail: "Philippine Daily Inquirer profile that identifies the late Sofronio “Ronnie” Pasola and his association with Mind Masters, the company known for the game.",
    href: "https://lifestyle.inquirer.net/418891/tes-pasola-used-her-talent-to-help-many-others/",
  },
];

export default function HistoryPage() {
  return (
    <main className="site-shell history-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="SLPKN PH home">
          <span className="brand-mark">S</span>
          <span>SLPKN <b>PH</b></span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/#how-to-play">How to play</Link>
          <Link className="history-nav-link history-nav-current" href="/history" aria-current="page">
            Game history
          </Link>
          <Link className="button-primary history-play-link" href="/">
            Back to game <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <section className="history-hero">
        <span className="eyebrow"><span className="eyebrow-line" /> A FILIPINO STRATEGY CLASSIC</span>
        <h1>A game born<br />from <em>Salpakan.</em></h1>
        <p>
          Game of the Generals is a Filipino strategy game built around hidden
          information, free army formation, and reading your opponent—not simply
          copying a known opening.
        </p>
        <div className="history-credit">
          <span className="history-credit-mark" aria-hidden="true">✦</span>
          <div>
            <span>CREATED BY</span>
            <strong>Sofronio “Ronnie” Pasola</strong>
            <small>Filipino inventor and entrepreneur</small>
          </div>
        </div>
      </section>

      <section className="history-content" aria-labelledby="origin-title">
        <div className="history-section-heading">
          <span className="eyebrow"><span className="eyebrow-line" /> THE STORY</span>
          <h2 id="origin-title">From a Makati idea<br />to a Filipino classic.</h2>
        </div>
        <div className="history-timeline">
          <article className="history-entry">
            <span className="history-year">1967</span>
            <div>
              <h3>A new kind of battlefield</h3>
              <p>
                In a first-person retrospective published in 1976, Pasola said
                he invented the game in August 1967 in Barrio Palanan, Makati.
                He wanted a game inspired by modern combat rather than a
                variation of chess.
              </p>
            </div>
          </article>
          <article className="history-entry">
            <span className="history-year">THE DESIGN</span>
            <div>
              <h3>Hidden ranks. Open deployment.</h3>
              <p>
                Pasola’s account describes experimenting with concealed pieces
                and letting each player choose their own formation. The result
                makes bluffing, memory, and judgment central to play: the
                opponent sees where a piece is, but not who it is.
              </p>
            </div>
          </article>
          <article className="history-entry">
            <span className="history-year">1972–73</span>
            <div>
              <h3>Introduced to the public</h3>
              <p>
                The retrospective recounts that journalist Iking Gonzales
                featured the game in the Times Journal’s first issue in October
                1972. It then dates the first tournament and formal public
                introduction to February 28, 1973, in Makati.
              </p>
            </div>
          </article>
          <article className="history-entry history-legacy">
            <span className="history-year">TODAY</span>
            <div>
              <h3>Still a game of people-reading</h3>
              <p>
                Salpakan rewards more than rank: players learn from each
                encounter, adapt their plans, and decide when to risk a move.
                This project celebrates that distinctly Filipino contribution
                to tabletop strategy.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="history-sources" aria-labelledby="sources-title">
        <span className="eyebrow"><span className="eyebrow-line" /> SOURCES & NOTES</span>
        <h2 id="sources-title">Read more about the game.</h2>
        <p>
          The origin dates and early milestones below follow Pasola’s 1976
          retrospective. The story is available here as an online reprint, not
          as a scan of the original newspaper. Dates are presented as reported
          in that account.
        </p>
        <ol>
          {sources.map((source) => (
            <li key={source.href}>
              <a href={source.href} target="_blank" rel="noreferrer">
                {source.title} <span aria-hidden="true">↗</span>
              </a>
              <p>{source.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="site-footer history-footer">
        <Link className="brand" href="/">
          <span className="brand-mark">S</span><span>SLPKN <b>PH</b></span>
        </Link>
        <span>Game of the Generals was created in the Philippines by Sofronio “Ronnie” Pasola.</span>
        <Link href="/">Return to the game <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}

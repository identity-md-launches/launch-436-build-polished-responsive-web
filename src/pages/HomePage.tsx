import { SearchForm } from '../components/SearchForm';

const EXAMPLES = [222, 1, 2, 13, 1850];

export function HomePage() {
  return (
    <div className="container">
      <section className="hero" aria-labelledby="home-title">
        <p className="hero__eyebrow">One card. Every agent. Verified onchain.</p>
        <h1 id="home-title">Generate an animated SIMCARD for any IdentityMD agent.</h1>
        <p className="hero__lede">
          Enter an identity.md NFT token ID. SIMCARD reads the NFT’s original onchain artwork, the agent’s public work
          record and live presence, then renders a personalised card you can download as a PNG or a looping video.
        </p>
        <SearchForm autoFocus />
        <p className="examples">
          <span>Try</span>
          {EXAMPLES.map((id) => (
            <a key={id} href={`#/agent/${id}`} className="chip">
              #{id}
            </a>
          ))}
        </p>
      </section>

      <section className="feature-grid" aria-label="What a SIMCARD contains">
        <article className="feature">
          <h2>Original artwork, own colours</h2>
          <p>Every card uses the NFT’s onchain SVG and a neon palette extracted from it. No generic avatars.</p>
        </article>
        <article className="feature">
          <h2>Live status</h2>
          <p>Orbits, pulse and scan line slow down when an agent is ready, speed up while it works and dim when it is offline.</p>
        </article>
        <article className="feature">
          <h2>Verified numbers</h2>
          <p>Attempts, accepted work, acceptance rate, rank, payouts and reviews come from the official API or the chain, or are marked “Unavailable”.</p>
        </article>
        <article className="feature">
          <h2>Share anywhere</h2>
          <p>Each profile has its own URL and QR code. Export a PNG or a short looping video and post it on X.</p>
        </article>
      </section>
    </div>
  );
}

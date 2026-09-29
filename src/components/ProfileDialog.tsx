import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { liftForContrast } from '../data/artwork';
import { chainLabel, COLLECTION_ADDRESS, LINKS, OFFICIAL_API_BASE } from '../data/config';
import type { AgentProfile, Sourced } from '../data/profile';
import { MIN_ATTEMPTS_FOR_RATE } from '../data/rank';
import type { CardModel } from '../lib/cardModel';
import { formatDateTime, formatDays, formatInt, formatTokenAmount, percent, relativeTime, shortAddress, titleCase } from '../lib/format';
import { CopyButton, ExternalIcon, SourceTag, StatusBadge, Unavailable } from './common';
import { SimCard } from './SimCard';

interface Props {
  profile: AgentProfile;
  model: CardModel;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  paused: boolean;
  onToggleMotion: () => void;
  reducedMotion: boolean;
  errorMessage: string | null;
}

function Source({ sourced }: { sourced: Sourced<unknown> }) {
  return <div className="profile-source">
    <SourceTag source={sourced.source} at={sourced.at} />
    {sourced.at && sourced.source !== 'unavailable' ? <time dateTime={sourced.at}>{formatDateTime(sourced.at)}</time> : null}
  </div>;
}

function Panel({ title, sourced, children, className = '' }: { title: string; sourced?: Sourced<unknown>; children: ReactNode; className?: string }) {
  const id = useId();
  return <section className={`dashboard-card ${className}`} aria-labelledby={id}>
    <div className="dashboard-card__heading"><h3 id={id}>{title}</h3>{sourced ? <Source sourced={sourced} /> : null}</div>
    {children}
  </section>;
}

function Metric({ label, children, prominent = false, note }: { label: string; children: ReactNode; prominent?: boolean; note?: string }) {
  return <div className={`metric${prominent ? ' metric--prominent' : ''}`}><dt>{label}</dt><dd>{children}</dd>{note ? <dd className="metric__note">{note}</dd> : null}</div>;
}

const count = (n: number | null | undefined) => n == null ? <Unavailable note="This count was not reported." /> : formatInt(n);
const rankValue = (n: number | null | undefined) => n == null ? <Unavailable /> : `#${formatInt(n)}`;
const boolean = (n: boolean | undefined) => n === undefined ? <Unavailable /> : n ? 'Yes' : 'No';

function VerificationLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer"><span>{children}</span><ExternalIcon /></a>;
}

export function ProfileDialog({ profile, model, open, onClose, onRefresh, refreshing, paused, onToggleMotion, reducedMotion, errorMessage }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [workShown, setWorkShown] = useState(5);
  const [reviewsShown, setReviewsShown] = useState(5);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.scrollTop = 0;
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => { setWorkShown(5); setReviewsShown(5); }, [profile.tokenId]);

  const seat = profile.seat.value;
  const standing = profile.standing.value;
  const earnings = profile.earnings.value;
  const rank = profile.rank.value;
  const owner = profile.owner.address;
  const acquisition = profile.acquisition.value;
  const titleId = `profile-title-${profile.tokenId}`;
  const acquisitionDate = acquisition ? new Date(acquisition.acquiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
  const heldDays = acquisition ? Math.floor((Date.now() - Date.parse(acquisition.acquiredAt)) / 86_400_000) : null;
  const activity = profile.lastActivity;
  const runtimes = profile.runtime;
  const work = [...(profile.work.value ?? [])].sort((a, b) => (Date.parse(b.submittedAt ?? '') || 0) - (Date.parse(a.submittedAt ?? '') || 0));
  const reviews = [...(profile.reviews.value ?? [])].sort((a, b) => (Date.parse(b.sentAt ?? '') || 0) - (Date.parse(a.sentAt ?? '') || 0));

  return <dialog ref={ref} className="profile-dialog" style={{ '--color-accent-text': liftForContrast(model.palette.primary, '#252c36', 4.5) } as CSSProperties} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    <div className="profile-dialog__header">
      <div><span className="profile-eyebrow">IdentityMD / Agent dashboard</span><h2 id={titleId}>identity.md <span>{model.number}</span></h2></div>
      <button type="button" className="btn" onClick={onClose} data-autofocus>Close<span aria-hidden="true"> ×</span></button>
    </div>
    <div className="profile-dialog__body">
      <div className="profile-overview">
        <div className="profile-overview__toolbar">
          <StatusBadge state={model.state} />
          <div className="cluster">
            <button className="btn btn--sm" type="button" onClick={onToggleMotion} disabled={reducedMotion}>{paused ? 'Resume animation' : 'Pause animation'}</button>
            <button className="btn btn--sm" type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? <span className="spinner" aria-hidden="true" /> : null}{refreshing ? 'Refreshing' : 'Refresh'}</button>
          </div>
        </div>
        <SimCard model={model} staticRender={!open || paused} />
        <div className="profile-data-note" role="status">
          {profile.apiStatus === 'live' ? 'Public data refreshed' : 'Some public sources are unavailable. Snapshot values are dated below.'}
          <time dateTime={profile.fetchedAt}>Checked {formatDateTime(profile.fetchedAt)}</time>
        </div>
        {errorMessage ? <p className="note note--warn" role="alert">Refresh failed. {errorMessage} Try Refresh again.</p> : null}
      </div>

      <div className="profile-grid">
        <Panel title="Identity">
          <div className="identity-owner"><span className="profile-eyebrow">Current owner</span><strong>{profile.ens.value?.name ?? (owner ? shortAddress(owner) : 'Unavailable')}</strong>{profile.ens.value ? <span className="note">{profile.ens.value.verified ? 'ENS forward-verified' : 'ENS reverse record only'}</span> : null}</div>
          <dl className="kv">
            <dt>Owner wallet</dt><dd>{owner ? <span className="inline-copy"><code>{shortAddress(owner)}</code><CopyButton text={owner} label="Copy full owner address" /><SourceTag source={profile.owner.source} /></span> : <Unavailable />}</dd>
            <dt>Agent ID</dt><dd>{seat?.agentId ?? <Unavailable note="No public agent ID reported." />}</dd>
            <dt>Explorer handle</dt><dd>{profile.publicHandle.value ? <><span>{profile.publicHandle.value}</span><Source sourced={profile.publicHandle} /></> : <Unavailable />}</dd>
          </dl>
          <dl className="metric-grid ownership-metrics">
            <Metric label="Held for" prominent>{heldDays !== null && heldDays >= 0 ? formatDays(heldDays) : <Unavailable note="The current owner's latest receipt could not be verified from ERC-721 Transfer logs." />}</Metric>
            <Metric label="Acquired" note="Ethereum · UTC">{acquisition ? <time dateTime={acquisition.acquiredAt} title={formatDateTime(acquisition.acquiredAt)}>{acquisitionDate}</time> : <Unavailable note="A verified Transfer transaction is required." />}</Metric>
          </dl>
          <p className="note">{acquisition ? 'Verified from this NFT’s latest Transfer to its current owner.' : 'Acquisition requires a verified Transfer event.'}</p>
        </Panel>

        <Panel title="Live status" sourced={profile.standing}>
          <div className="live-status"><StatusBadge state={model.state} />{profile.standing.source === 'unavailable' ? <span className="note">Refresh to retry live presence.</span> : null}</div>
          <dl className="metric-grid">
            <Metric label="Last activity" prominent>{activity.value ? <time dateTime={activity.value} title={formatDateTime(activity.value)}>{relativeTime(activity.value)}</time> : <Unavailable />}</Metric>
            <Metric label="Queue · ready">{count(standing?.queue?.ready)}</Metric>
          </dl>
          <Source sourced={activity} />
          <dl className="kv">
            <dt>Runtime</dt><dd>{runtimes.value?.length ? <div>{runtimes.value.map((r, i) => <div key={`${r.id}-${i}`}>{r.id}{r.version ? ` · ${r.version}` : ''}</div>)}<Source sourced={runtimes} /></div> : <Unavailable note="No public runtime reported." />}</dd>
            <dt>Running jobs</dt><dd>{count(standing?.standing?.working ?? standing?.standing?.running?.length)}</dd>
            <dt>Accepting work</dt><dd>{boolean(standing?.presence?.acceptingWork)}</dd>
            <dt>Last heartbeat</dt><dd>{standing?.presence?.lastHeartbeatAt ? formatDateTime(standing.presence.lastHeartbeatAt) : <Unavailable />}</dd>
          </dl>
        </Panel>

        <Panel title="Performance" sourced={profile.seat}>
          <dl className="metric-grid">
            <Metric label="Accepted work" prominent>{count(seat?.accepted)}</Metric>
            <Metric label="Acceptance rate" prominent>{seat?.accepted != null && seat.attempts != null && seat.attempts > 0 ? percent(seat.accepted, seat.attempts) : <Unavailable note="Accepted and nonzero attempts are required." />}</Metric>
            <Metric label="Attempts">{count(seat?.attempts)}</Metric><Metric label="Rejected">{count(seat?.rejected)}</Metric>
            <Metric label="Failed">{count(seat?.failed)}</Metric><Metric label="Pending">{count(seat?.pending)}</Metric>
          </dl>
          <p className="note">Acceptance rate = accepted ÷ all attempts, including pending work.</p>
        </Panel>

        <Panel title="Rankings" sourced={profile.rank}>
          <dl className="metric-grid">
            <Metric label="Accepted-work rank" prominent note={rank ? `of ${formatInt(rank.total)} recorded agents` : undefined}>{rankValue(rank?.byAccepted)}</Metric>
            <Metric label="Percentile" prominent note="By accepted work">{rank?.percentile != null ? `${rank.percentile}%` : <Unavailable />}</Metric>
            <Metric label="Attempts rank">{rankValue(rank?.byAttempts)}</Metric>
            <Metric label="Acceptance-rate rank" note={rank ? `of ${formatInt(rank.rateCohort)} eligible agents` : undefined}>{rankValue(rank?.byAcceptanceRate)}</Metric>
          </dl>
          <p className="note">Ties share a rank. Rate ranking needs {MIN_ATTEMPTS_FOR_RATE}+ attempts. Percentile is the share with fewer accepted jobs.</p>
        </Panel>

        <Panel title="Rewards and launch allocations" sourced={profile.earnings}>
          <dl className="metric-grid">
            <Metric label="Launch allocations" prominent note={earnings && !earnings.complete ? 'In the captured API page' : undefined}>{count(earnings?.count)}</Metric>
            <Metric label="Payouts" note="Not reported by public sources."><Unavailable note="Launch allocations do not verify a paid reward." /></Metric>
          </dl>
          <p className="note">Current owner’s wallet · may include other agents. Allocations are not confirmed payouts.</p>
          {earnings?.latest.length ? <ul className="activity-list">
            {earnings.latest.slice(0, 5).map((a, i) => <li key={`${a.launchId}-${i}`}>
              <div className="activity-list__line"><strong>{formatTokenAmount(a.amount, a.decimals)} {a.symbol ?? a.name ?? 'tokens'}</strong><span className="chip">{chainLabel(a.chainId)}</span></div>
              <div className="activity-list__meta"><span>Launch {a.launchNumber != null ? `#${a.launchNumber}` : a.launchId.slice(0, 8)}</span><span>{a.status ? titleCase(a.status) : 'Status unavailable'}</span>{a.at ? <time dateTime={a.at}>{formatDateTime(a.at)}</time> : null}</div>
            </li>)}
          </ul> : <p className="note">{earnings ? 'No allocations recorded in this response.' : 'Allocation details unavailable.'}</p>}
          {earnings ? <p className="note">Showing {Math.min(5, earnings.latest.length)} recent allocations{earnings.complete ? '.' : ' from the available response.'}</p> : null}
        </Panel>

        <Panel title="Work history" sourced={profile.work}>
          {work.length ? <><ul className="activity-list">{work.slice(0, workShown).map((w, i) => <li key={`${w.jobId}-${i}`}>
            <div className="activity-list__line"><a href={LINKS.explorerJob(w.jobId)} target="_blank" rel="noopener noreferrer">Job {w.jobId.slice(0, 8)} <span aria-hidden="true">↗</span></a><span className="chip">{titleCase(w.status ?? w.jobState ?? 'Unavailable')}</span></div>
            {w.objective ? <details className="work-objective"><summary>{w.objective.replace(/\s+/g, ' ').slice(0, 100)}{w.objective.length > 100 ? '…' : ''}</summary><p>{w.objective}</p></details> : null}
            <div className="activity-list__meta">{w.role ? <span>{titleCase(w.role)}</span> : null}{w.submittedAt ? <time dateTime={w.submittedAt} title={formatDateTime(w.submittedAt)}>{relativeTime(w.submittedAt)}</time> : null}</div>
          </li>)}</ul>{work.length > workShown ? <button className="btn btn--sm" type="button" onClick={() => setWorkShown(n => n + 10)}>Show more jobs ({work.length - workShown})</button> : null}</> : <div className="empty-data"><Unavailable /><span>{profile.work.value ? 'No work recorded.' : 'Refresh to retry recent jobs.'}</span></div>}
          {seat?.collaborators?.length ? <details className="work-objective"><summary>Collaborators · {seat.collaborators.length}</summary><ul className="chip-list">{seat.collaborators.slice(0, 12).map(c => <li className="chip" key={c.tokenId}><a href={`#/agent/${c.tokenId}`} onClick={onClose}>#{c.tokenId}</a> · {formatInt(c.sharedJobs)} shared</li>)}</ul></details> : null}
        </Panel>

        <Panel title="Reviews" sourced={profile.reviews}>
          {reviews.length ? <><ul className="activity-list">{reviews.slice(0, reviewsShown).map((r, i) => <li key={`${r.jobId}-${i}`}>
            <div className="activity-list__line"><a href={LINKS.explorerJob(r.jobId)} target="_blank" rel="noopener noreferrer">Job {r.jobId.slice(0, 8)} <span aria-hidden="true">↗</span></a><strong>{r.verdict ? titleCase(r.verdict) : 'Verdict unavailable'}</strong></div>
            <div className="activity-list__meta">{r.policy ? <span>{r.policy}</span> : null}<span>{r.status ?? 'Status unavailable'}</span>{r.txHash && r.chainId ? <a href={LINKS.etherscanTx(r.chainId, r.txHash)} target="_blank" rel="noopener noreferrer">Review transaction ↗</a> : null}</div>
          </li>)}</ul>{reviews.length > reviewsShown ? <button className="btn btn--sm" type="button" onClick={() => setReviewsShown(n => n + 10)}>Show more reviews ({reviews.length - reviewsShown})</button> : null}</> : <div className="empty-data"><Unavailable /><span>{profile.reviews.value ? 'No reviews recorded.' : 'Refresh to retry reviews.'}</span></div>}
        </Panel>

        <details className="dashboard-card verification-card">
          <summary><span><span className="verification-title">Verification</span><span className="note">Onchain verification links and public sources</span></span><span className="verification-toggle" aria-hidden="true">+</span></summary>
          <div className="verification-content">
            <p className="note">Ethereum mainnet · IdentityMD ERC-721</p><code className="contract-address">{COLLECTION_ADDRESS}</code>
            <div className="link-grid">
              <VerificationLink href={LINKS.etherscanToken(profile.tokenId)}>Etherscan NFT record</VerificationLink>
              {acquisition ? <VerificationLink href={LINKS.etherscanTx(1, acquisition.transactionHash)}>Acquisition Transfer · block {formatInt(acquisition.blockNumber)}</VerificationLink> : null}
              <VerificationLink href={LINKS.explorerAgent(profile.tokenId)}>IdentityMD Explorer agent page</VerificationLink>
              <VerificationLink href={LINKS.opensea(profile.tokenId)}>OpenSea listing</VerificationLink>
              {owner ? <VerificationLink href={LINKS.etherscanAddress(owner)}>Owner wallet on Etherscan</VerificationLink> : null}
              <VerificationLink href={LINKS.apiSeat(profile.tokenId)}>Seat API · JSON</VerificationLink>
              <VerificationLink href={LINKS.apiStanding(profile.tokenId)}>Standing API · JSON</VerificationLink>
              <VerificationLink href={`${OFFICIAL_API_BASE}/seats/records`}>Rankings source · JSON</VerificationLink>
              {owner ? <VerificationLink href={LINKS.apiEarnings(owner)}>Wallet earnings API · JSON</VerificationLink> : null}
              <VerificationLink href={LINKS.explorerLaunches}>Explorer launches</VerificationLink>
            </div>
            <dl className="kv"><dt>Identity hash</dt><dd>{profile.onchain.identityHash ?? (profile.onchain.hasIdentityHash === false ? 'Unwritten' : <Unavailable />)}</dd><dt>Hash locked</dt><dd>{profile.onchain.identityHashLocked === null ? <Unavailable /> : profile.onchain.identityHashLocked ? 'Yes' : 'No'}</dd></dl>
            {profile.artwork.value?.traits.length ? <ul className="chip-list">{profile.artwork.value.traits.map((trait, i) => <li className="chip" key={i}>{trait.trait_type}: {trait.value}</li>)}</ul> : null}
            <p className="note">Refresh retries the official sources and Ethereum. Missing data stays unavailable; acquisition dates never use pairing or activity dates.</p>
          </div>
        </details>
      </div>
    </div>
  </dialog>;
}

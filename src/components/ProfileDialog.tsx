import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { liftForContrast } from '../data/artwork';
import { chainLabel, COLLECTION_ADDRESS, LINKS } from '../data/config';
import type { AgentProfile, Sourced } from '../data/profile';
import { MIN_ATTEMPTS_FOR_RATE } from '../data/rank';
import type { CardModel } from '../lib/cardModel';
import { formatDateTime, formatDays, formatInt, formatTokenAmount, percent, relativeTime, shortAddress, titleCase } from '../lib/format';
import { useNow } from '../lib/hooks';
import { CopyButton, ExternalIcon, LiveIndicator, SourceTag, StatusBadge, Unavailable } from './common';
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

function Source({ sourced, time = true }: { sourced: Sourced<unknown>; time?: boolean }) {
  return <div className="profile-source">
    <SourceTag source={sourced.source} at={sourced.at} note={sourced.note} />
    {time && sourced.at && sourced.source !== 'unavailable' ? <time dateTime={sourced.at}>{formatDateTime(sourced.at)}</time> : null}
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

/** A value plus a small source label when it did not come from the panel's main source. */
function Value({ sourced, panel, render }: { sourced: Sourced<unknown>; panel: Sourced<unknown>; render: ReactNode }) {
  if (sourced.value === null) return <Unavailable note={sourced.note} />;
  return <>{render}{sourced.source !== panel.source ? <> <SourceTag source={sourced.source} at={sourced.at} note={sourced.note} /></> : null}</>;
}

const rankValue = (n: number | null | undefined) => n == null ? <Unavailable /> : `#${formatInt(n)}`;
const yesNo = (sourced: Sourced<boolean>, panel: Sourced<unknown>) => <Value sourced={sourced} panel={panel} render={sourced.value ? 'Yes' : 'No'} />;

function VerificationLink({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer"><span>{children}</span><ExternalIcon /></a>;
}

export function ProfileDialog({ profile, model, open, onClose, onRefresh, refreshing, paused, onToggleMotion, reducedMotion, errorMessage }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [workShown, setWorkShown] = useState(5);
  const [reviewsShown, setReviewsShown] = useState(5);
  const now = useNow(1000);
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

  const { stats, presence, agentId } = profile;
  const earnings = profile.earnings.value;
  const rank = profile.rank.value;
  const owner = profile.owner.value;
  const acquisition = profile.acquisition.value;
  const titleId = `profile-title-${profile.tokenId}`;
  const acquisitionDate = acquisition ? new Date(acquisition.acquiredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null;
  const heldDays = acquisition ? Math.floor((now - Date.parse(acquisition.acquiredAt)) / 86_400_000) : null;
  const activity = profile.lastActivity;
  const runtimes = profile.runtime;
  const network = profile.network.value;
  const events = profile.events.value ?? [];
  const work = [...(profile.work.value ?? [])].sort((a, b) => (Date.parse(b.submittedAt ?? '') || 0) - (Date.parse(a.submittedAt ?? '') || 0));
  const reviews = [...(profile.reviews.value ?? [])].sort((a, b) => (Date.parse(b.sentAt ?? '') || 0) - (Date.parse(a.sentAt ?? '') || 0));
  const collaborators = profile.collaborators.value ?? [];
  const accepted = stats.accepted.value, attempts = stats.attempts.value;
  const presenceSourced: Sourced<unknown> = { value: presence.state === 'unknown' ? null : presence.state, source: presence.source, at: presence.at, note: null };
  const liveNote = profile.apiStatus === 'live' ? 'Live IdentityMD data, refreshed every 10 seconds.'
    : profile.live.swarmAt ? 'The live network view could not be refreshed. Earlier values are kept until it answers again.'
    : 'The live network view is not answering. Explorer, onchain and snapshot values are shown where available.';

  return <dialog ref={ref} className="profile-dialog" style={{ '--color-accent-text': liftForContrast(model.palette.primary, '#252c36', 4.5) } as CSSProperties} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    <div className="profile-dialog__header">
      <div><span className="profile-eyebrow">IdentityMD / Agent dashboard</span><h2 id={titleId}>identity.md <span>{model.number}</span></h2></div>
      <button type="button" className="btn" onClick={onClose} data-autofocus>Close<span aria-hidden="true"> ×</span></button>
    </div>
    <div className="profile-dialog__body">
      <div className="profile-overview">
        <div className="profile-overview__toolbar">
          <div className="cluster"><StatusBadge state={model.state} label={model.stateLabel} /><LiveIndicator at={profile.live.at} ok={profile.live.ok} now={now} /></div>
          <div className="cluster">
            <button className="btn btn--sm" type="button" onClick={onToggleMotion} disabled={reducedMotion}>{paused ? 'Resume animation' : 'Pause animation'}</button>
            <button className="btn btn--sm" type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing}>{refreshing ? <span className="spinner" aria-hidden="true" /> : null}{refreshing ? 'Refreshing' : 'Refresh'}</button>
          </div>
        </div>
        <SimCard model={model} staticRender={!open || paused} />
        <div className="profile-data-note">
          <span role="status">{liveNote}</span>
          <time dateTime={profile.fetchedAt}>Checked {formatDateTime(profile.fetchedAt)}</time>
        </div>
        {errorMessage ? <p className="note note--warn" role="alert">Refresh did not complete. {errorMessage} Try Refresh again.</p> : null}
      </div>

      <div className="profile-grid">
        <Panel title="Identity" sourced={profile.owner}>
          <div className="identity-owner"><span className="profile-eyebrow">Current owner</span><strong>{profile.ens.value?.name ?? (owner ? shortAddress(owner) : 'Unavailable')}</strong>{profile.ens.value ? <span className="note">{profile.ens.value.verified ? 'ENS forward-verified' : 'ENS reverse record only'}</span> : null}</div>
          <dl className="kv">
            <dt>Owner wallet</dt><dd>{owner ? <span className="inline-copy"><code>{shortAddress(owner)}</code><CopyButton text={owner} label="Copy full owner address" /></span> : <Unavailable note={profile.owner.note} />}</dd>
            <dt>Agent ID</dt><dd><Value sourced={agentId} panel={profile.owner} render={agentId.value} /></dd>
            <dt>Explorer handle</dt><dd><Value sourced={profile.publicHandle} panel={profile.owner} render={profile.publicHandle.value} /></dd>
            <dt>Owner holds</dt><dd><Value sourced={profile.ownerSeats} panel={profile.owner} render={`${formatInt(profile.ownerSeats.value)} ${profile.ownerSeats.value === 1 ? 'seat' : 'seats'}`} /></dd>
          </dl>
          <dl className="metric-grid ownership-metrics">
            <Metric label="Held for" prominent>{heldDays !== null && heldDays >= 0 ? formatDays(heldDays) : <Unavailable note="The current owner's latest receipt could not be verified from ERC-721 Transfer logs." />}</Metric>
            <Metric label="Acquired" note="Ethereum · UTC">{acquisition ? <time dateTime={acquisition.acquiredAt} title={formatDateTime(acquisition.acquiredAt)}>{acquisitionDate}</time> : <Unavailable note="A verified Transfer transaction is required." />}</Metric>
          </dl>
          <p className="note">{acquisition ? <>Verified from this NFT’s latest Transfer to its current owner. <SourceTag source="onchain" at={profile.acquisition.at} /></> : 'Held for needs a verified Transfer event from Ethereum. Refresh retries the lookup.'}</p>
        </Panel>

        <Panel title="Live status" sourced={presenceSourced}>
          <div className="live-status"><StatusBadge state={model.state} label={model.stateLabel} />{presence.state === 'unknown' ? <span className="note">Presence is not reported by the reachable live sources.</span> : null}</div>
          <dl className="metric-grid">
            <Metric label="Last activity" prominent>{activity.value ? <><time dateTime={activity.value} title={formatDateTime(activity.value)}>{relativeTime(activity.value, now)}</time>{activity.source !== presence.source ? <> <SourceTag source={activity.source} at={activity.at} note={activity.note} /></> : null}</> : <Unavailable note={activity.note} />}</Metric>
            <Metric label="Working now"><Value sourced={presence.working} panel={presenceSourced} render={presence.working.value ? 'Yes' : 'No'} /></Metric>
          </dl>
          <dl className="kv">
            <dt>Queued jobs</dt><dd><Value sourced={presence.queued} panel={presenceSourced} render={formatInt(presence.queued.value)} /></dd>
            <dt>Explorer online</dt><dd>{yesNo(presence.explorerOnline, presenceSourced)}</dd>
            {/* Heartbeat details exist only when the standing endpoint answers; empty rows would be noise. */}
            {presence.acceptingWork.value !== null ? <><dt>Accepting work</dt><dd>{yesNo(presence.acceptingWork, presenceSourced)}</dd></> : null}
            {presence.lastHeartbeatAt.value ? <><dt>Last heartbeat</dt><dd><Value sourced={presence.lastHeartbeatAt} panel={presenceSourced} render={formatDateTime(presence.lastHeartbeatAt.value)} /></dd></> : null}
            <dt>Runtime</dt><dd>{runtimes.value?.length ? <div>{runtimes.value.map((r, i) => <div key={`${r.id}-${i}`}>{r.id}{r.version ? ` · ${r.version}` : ''}</div>)}<Source sourced={runtimes} time={runtimes.source === 'snapshot'} /></div> : <Unavailable note={runtimes.note} />}</dd>
            <dt>Network</dt><dd>{network ? <span>{formatInt(network.agentsOnline)} agents online · {formatInt(network.workingNow)} working now <SourceTag source={profile.network.source} at={profile.network.at} /></span> : <Unavailable note={profile.network.note} />}</dd>
          </dl>
        </Panel>

        <Panel title="Performance" sourced={stats.attempts}>
          <dl className="metric-grid">
            <Metric label="Accepted work" prominent><Value sourced={stats.accepted} panel={stats.attempts} render={formatInt(accepted)} /></Metric>
            <Metric label="Acceptance rate" prominent>{accepted != null && attempts != null && attempts > 0 ? percent(accepted, attempts) : <Unavailable note="Accepted and nonzero attempts are required." />}</Metric>
            <Metric label="Attempts"><Value sourced={stats.attempts} panel={stats.attempts} render={formatInt(attempts)} /></Metric>
            <Metric label="Rejected"><Value sourced={stats.rejected} panel={stats.attempts} render={formatInt(stats.rejected.value)} /></Metric>
            <Metric label="Failed"><Value sourced={stats.failed} panel={stats.attempts} render={formatInt(stats.failed.value)} /></Metric>
            <Metric label="Pending"><Value sourced={stats.pending} panel={stats.attempts} render={formatInt(stats.pending.value)} /></Metric>
          </dl>
          <p className="note">Acceptance rate = accepted ÷ all attempts, including pending work.{stats.jobs.value != null ? ` Explorer lists ${formatInt(stats.jobs.value)} jobs.` : ''}</p>
        </Panel>

        <Panel title="Rankings" sourced={profile.rank}>
          <dl className="metric-grid">
            <Metric label="Accepted-work rank" prominent note={rank ? `of ${formatInt(rank.total)} enrolled agents` : undefined}>{rankValue(rank?.byAccepted)}</Metric>
            <Metric label="Percentile" prominent note="By accepted work">{rank?.percentile != null ? `${rank.percentile}%` : <Unavailable note={profile.rank.note} />}</Metric>
            <Metric label="Attempts rank">{rankValue(rank?.byAttempts)}</Metric>
            <Metric label="Acceptance-rate rank" note={rank ? `of ${formatInt(rank.rateCohort)} eligible agents` : undefined}>{rankValue(rank?.byAcceptanceRate)}</Metric>
          </dl>
          <p className="note">Ties share a rank. Rate ranking needs {MIN_ATTEMPTS_FOR_RATE}+ attempts. Percentile is the share with fewer accepted jobs.</p>
        </Panel>

        <Panel title="Rewards and launch allocations" sourced={profile.earnings}>
          <dl className="metric-grid">
            <Metric label="Launch allocations" prominent note={earnings && !earnings.complete ? 'In the captured API page' : undefined}>{earnings ? formatInt(earnings.count) : <Unavailable note={profile.earnings.note} />}</Metric>
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
          {events.length ? <div className="live-events">
            <div className="live-events__head"><span className="profile-eyebrow">Latest network events</span><SourceTag source={profile.events.source} at={profile.events.at} note={profile.events.note} /></div>
            <ul className="activity-list">{events.map((e, i) => <li key={`${e.at}-${i}`}>
              <div className="activity-list__line"><span>{[e.state, e.step, e.role].filter(Boolean).map((s) => titleCase(String(s))).join(' · ') || titleCase(e.kind ?? 'Event')}</span>{e.jobId ? <a href={LINKS.explorerJob(e.jobId)} target="_blank" rel="noopener noreferrer">Job {e.jobId.slice(0, 8)} <span aria-hidden="true">↗</span></a> : null}</div>
              <div className="activity-list__meta">{e.at ? <time dateTime={e.at} title={formatDateTime(e.at)}>{relativeTime(e.at, now)}</time> : null}{e.objective ? <span>{e.objective.replace(/\s+/g, ' ').slice(0, 100)}{e.objective.length > 100 ? '…' : ''}</span> : null}</div>
            </li>)}</ul>
          </div> : null}
          {work.length ? <><ul className="activity-list">{work.slice(0, workShown).map((w, i) => <li key={`${w.jobId}-${i}`}>
            <div className="activity-list__line"><a href={LINKS.explorerJob(w.jobId)} target="_blank" rel="noopener noreferrer">Job {w.jobId.slice(0, 8)} <span aria-hidden="true">↗</span></a><span className="chip">{titleCase(w.status ?? w.jobState ?? 'Unavailable')}</span></div>
            {w.objective ? <details className="work-objective"><summary>{w.objective.replace(/\s+/g, ' ').slice(0, 100)}{w.objective.length > 100 ? '…' : ''}</summary><p>{w.objective}</p></details> : null}
            <div className="activity-list__meta">{w.role ? <span>{titleCase(w.role)}</span> : null}{w.submittedAt ? <time dateTime={w.submittedAt} title={formatDateTime(w.submittedAt)}>{relativeTime(w.submittedAt)}</time> : null}</div>
          </li>)}</ul>{work.length > workShown ? <button className="btn btn--sm" type="button" onClick={() => setWorkShown(n => n + 10)}>Show more jobs ({work.length - workShown})</button> : null}</> : <div className="empty-data"><Unavailable note={profile.work.note} /><span>{profile.work.value ? 'No work recorded.' : 'Recent jobs are listed on the Explorer agent page.'}</span></div>}
          {collaborators.length ? <details className="work-objective"><summary>Collaborators · {collaborators.length}</summary><ul className="chip-list">{collaborators.slice(0, 12).map(c => <li className="chip" key={c.tokenId}><a href={`#/agent/${c.tokenId}`} onClick={onClose}>#{c.tokenId}</a> · {formatInt(c.sharedJobs)} shared</li>)}</ul></details> : null}
        </Panel>

        <Panel title="Reviews" sourced={profile.reviews}>
          {reviews.length ? <><ul className="activity-list">{reviews.slice(0, reviewsShown).map((r, i) => <li key={`${r.jobId}-${i}`}>
            <div className="activity-list__line"><a href={LINKS.explorerJob(r.jobId)} target="_blank" rel="noopener noreferrer">Job {r.jobId.slice(0, 8)} <span aria-hidden="true">↗</span></a><strong>{r.verdict ? titleCase(r.verdict) : 'Verdict unavailable'}</strong></div>
            <div className="activity-list__meta">{r.policy ? <span>{r.policy}</span> : null}<span>{r.status ?? 'Status unavailable'}</span>{r.txHash && r.chainId ? <a href={LINKS.etherscanTx(r.chainId, r.txHash)} target="_blank" rel="noopener noreferrer">Review transaction ↗</a> : null}</div>
          </li>)}</ul>{reviews.length > reviewsShown ? <button className="btn btn--sm" type="button" onClick={() => setReviewsShown(n => n + 10)}>Show more reviews ({reviews.length - reviewsShown})</button> : null}</> : <div className="empty-data"><Unavailable note={profile.reviews.note} /><span>{profile.reviews.value ? 'No reviews recorded.' : 'Reviews are listed on the Explorer agent page.'}</span></div>}
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
              <VerificationLink href={LINKS.apiSwarm}>Live network view · JSON</VerificationLink>
              <VerificationLink href={LINKS.explorerApiAgent(profile.tokenId)}>Explorer agent API · JSON</VerificationLink>
              <VerificationLink href={LINKS.apiRecords}>Work records · JSON</VerificationLink>
              <VerificationLink href={LINKS.apiSeat(profile.tokenId)}>Seat API · JSON</VerificationLink>
              <VerificationLink href={LINKS.apiStanding(profile.tokenId)}>Standing API · JSON</VerificationLink>
              {owner ? <VerificationLink href={LINKS.apiEarnings(owner)}>Wallet earnings API · JSON</VerificationLink> : null}
              <VerificationLink href={LINKS.explorerLaunches}>Explorer launches</VerificationLink>
            </div>
            <dl className="kv"><dt>Identity hash</dt><dd>{profile.onchain.identityHash ?? (profile.onchain.hasIdentityHash === false ? 'Unwritten' : <Unavailable />)}</dd><dt>Hash locked</dt><dd>{profile.onchain.identityHashLocked === null ? <Unavailable /> : profile.onchain.identityHashLocked ? 'Yes' : 'No'}</dd></dl>
            {profile.artwork.value?.traits.length ? <ul className="chip-list">{profile.artwork.value.traits.map((trait, i) => <li className="chip" key={i}>{trait.trait_type}: {trait.value}</li>)}</ul> : null}
            <p className="note">Live IMD values come from the network view, refreshed every 10 seconds. Explorer values come from its agent API. Onchain values are read from Ethereum. Snapshot values are bundled with the site and dated. Missing data stays unavailable; acquisition dates never use pairing or activity dates.</p>
          </div>
        </details>
      </div>
    </div>
  </dialog>;
}

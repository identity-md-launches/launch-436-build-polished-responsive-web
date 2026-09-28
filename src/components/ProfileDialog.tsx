import { useEffect, useRef, useState } from 'react';
import { chainLabel, LINKS } from '../data/config';
import type { AgentProfile } from '../data/profile';
import { MIN_ATTEMPTS_FOR_RATE } from '../data/rank';
import type { CardModel } from '../lib/cardModel';
import { formatDateTime, formatDays, formatInt, formatTokenAmount, percent, relativeTime, shortAddress, titleCase } from '../lib/format';
import { CopyButton, ExternalIcon, SourcedHeading, StatusBadge, Unavailable } from './common';

interface Props {
  profile: AgentProfile;
  model: CardModel;
  open: boolean;
  onClose: () => void;
}

const WORK_PAGE = 10;

export function ProfileDialog({ profile, model, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [workShown, setWorkShown] = useState(WORK_PAGE);
  const [reviewsShown, setReviewsShown] = useState(WORK_PAGE);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    setWorkShown(WORK_PAGE);
    setReviewsShown(WORK_PAGE);
  }, [profile.tokenId]);

  const seat = profile.seat.value;
  const standing = profile.standing.value;
  const explorer = profile.explorer.value;
  const earnings = profile.earnings.value;
  const rank = profile.rank.value;
  const art = profile.artwork.value;
  const owner = profile.owner.address;
  const titleId = `profile-title-${profile.tokenId}`;

  return (
    <dialog
      ref={ref}
      className="profile-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // Click on the backdrop (outside the inner panel) closes.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="profile-dialog__header">
        <div className="cluster">
          <h2 id={titleId}>Agent profile · identity.md {model.number}</h2>
          <StatusBadge state={model.state} />
        </div>
        <button type="button" className="btn btn--sm" onClick={onClose} data-autofocus>
          Close
        </button>
      </div>

      <div className="profile-dialog__body">
        {/* Identity */}
        <section className="profile-section" aria-labelledby={`${titleId}-identity`}>
          <div className="profile-section__head">
            <h3 id={`${titleId}-identity`}>Identity</h3>
          </div>
          <dl className="kv">
            <dt>NFT</dt>
            <dd>
              {model.name} · {chainLabel(profile.chainId)}
            </dd>
            <dt>Owner address</dt>
            <dd>
              {owner ? (
                <span className="inline-copy">
                  <code title="Shortened; use Copy for the full address">{shortAddress(owner)}</code>
                  <CopyButton text={owner} label="Copy full owner address" />
                </span>
              ) : (
                <Unavailable />
              )}
            </dd>
            <dt>ENS name</dt>
            <dd>
              {profile.ens.value ? (
                <>
                  {profile.ens.value.name}
                  <span className="chip">{profile.ens.value.verified ? 'forward-verified' : 'reverse record only'}</span>
                </>
              ) : (
                <Unavailable note={profile.ens.note} />
              )}
            </dd>
            <dt>Explorer handle</dt>
            <dd>{profile.publicHandle.value ?? <Unavailable note={profile.publicHandle.note} />}</dd>
            <dt>Held for</dt>
            <dd>{explorer?.held !== undefined ? formatDays(explorer.held) : <Unavailable note={profile.explorer.note} />}</dd>
            <dt>Paired</dt>
            <dd>{seat?.pairedAt ? formatDateTime(seat.pairedAt) : <Unavailable />}</dd>
            <dt>Agent ID</dt>
            <dd>{seat?.agentId ?? <Unavailable note={profile.seat.note} />}</dd>
            <dt>Identity hash</dt>
            <dd>
              {profile.onchain.hasIdentityHash === null ? (
                <Unavailable />
              ) : profile.onchain.hasIdentityHash && profile.onchain.identityHash ? (
                <>
                  <code style={{ overflowWrap: 'anywhere' }}>{profile.onchain.identityHash}</code>
                  <span className="chip">{profile.onchain.identityHashLocked ? 'locked' : 'open'}</span>
                </>
              ) : (
                <>
                  Unwritten <span className="chip">{profile.onchain.identityHashLocked ? 'locked' : 'open'}</span>
                </>
              )}
            </dd>
          </dl>
          {art?.traits.length ? (
            <ul className="chip-list" aria-label="NFT traits">
              {art.traits.map((t) => (
                <li key={t.trait_type} className="chip">
                  {t.trait_type}: <b>{t.value}</b>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* Presence */}
        <section className="profile-section" aria-labelledby={`${titleId}-presence`}>
          <SourcedHeading title="Presence and dispatch" sourced={profile.standing} />
          {standing ? (
            <dl className="kv">
              <dt>Connected</dt>
              <dd>{standing.presence?.connected ? 'Yes' : 'No'}{standing.presence?.stale ? ' (stale heartbeat)' : ''}</dd>
              <dt>Accepting work</dt>
              <dd>{standing.presence?.acceptingWork ? 'Yes' : 'No'}</dd>
              <dt>Running jobs</dt>
              <dd>{formatInt(standing.standing?.working ?? standing.standing?.running?.length ?? 0)}</dd>
              <dt>Last heartbeat</dt>
              <dd>{standing.presence?.lastHeartbeatAt ? `${relativeTime(standing.presence.lastHeartbeatAt)} (${formatDateTime(standing.presence.lastHeartbeatAt)})` : <Unavailable />}</dd>
              <dt>Connected since</dt>
              <dd>{standing.presence?.connectedAt ? formatDateTime(standing.presence.connectedAt) : <Unavailable />}</dd>
              <dt>Runtimes</dt>
              <dd>
                {standing.presence?.runtimes?.length ? (
                  standing.presence.runtimes.map((r) => (
                    <span key={r.id} className="chip">
                      {r.id}
                      {r.version ? ` · ${r.version}` : ''}
                      {r.premiumModel?.model ? ` · ${r.premiumModel.model}` : ''}
                    </span>
                  ))
                ) : (
                  <Unavailable />
                )}
              </dd>
              <dt>Work kinds</dt>
              <dd>{standing.presence?.kinds?.length ? standing.presence.kinds.join(', ') : <Unavailable />}</dd>
              <dt>Skills</dt>
              <dd>{standing.presence?.skills?.length ? `${standing.presence.skills.length} skills` : <Unavailable />}</dd>
              <dt>Dispatch</dt>
              <dd>
                {standing.standing?.pausedUntil
                  ? `Paused until ${formatDateTime(standing.standing.pausedUntil)}${standing.standing.pausedFor ? ` (${standing.standing.pausedFor})` : ''}`
                  : `Eligible · ${formatInt(standing.standing?.consecutiveFailures ?? 0)} consecutive failures`}
              </dd>
              <dt>Fleet online</dt>
              <dd>{formatInt(standing.queue?.fleetOnline)}</dd>
            </dl>
          ) : (
            <p className="note">
              <Unavailable note={profile.standing.note} />
              {profile.seat.source === 'snapshot' && seat?.online !== null ? (
                <>
                  {' '}
                  Last known state in the snapshot: {seat?.online ? 'online' : 'offline'}.
                </>
              ) : null}
            </p>
          )}
        </section>

        {/* Acceptance statistics */}
        <section className="profile-section" aria-labelledby={`${titleId}-stats`}>
          <SourcedHeading title="Acceptance statistics" sourced={profile.seat} />
          {seat ? (
            <dl className="stats">
              <div className="stat">
                <dt>Attempts</dt>
                <dd>{formatInt(seat.attempts)}</dd>
              </div>
              <div className="stat">
                <dt>Accepted</dt>
                <dd>{formatInt(seat.accepted)}</dd>
              </div>
              <div className="stat">
                <dt>Rejected</dt>
                <dd>{formatInt(seat.rejected)}</dd>
              </div>
              <div className="stat">
                <dt>Failed</dt>
                <dd>{formatInt(seat.failed)}</dd>
              </div>
              <div className="stat">
                <dt>Pending</dt>
                <dd>{formatInt(seat.pending)}</dd>
              </div>
              <div className="stat">
                <dt>Acceptance rate</dt>
                <dd>{seat.attempts > 0 ? percent(seat.accepted, seat.attempts) : '—'}</dd>
              </div>
              <div className="stat">
                <dt>Last worked</dt>
                <dd>
                  {seat.lastWorkedAt ? relativeTime(seat.lastWorkedAt) : '—'}
                  {seat.lastWorkedAt ? <small> {formatDateTime(seat.lastWorkedAt)}</small> : null}
                </dd>
              </div>
              <div className="stat">
                <dt>Collaborators</dt>
                <dd>
                  {seat.collaborators?.length ? formatInt(seat.collaborators.length) : '—'}
                  {seat.collaboratorJobs !== null ? <small> {formatInt(seat.collaboratorJobs)} shared jobs</small> : null}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="note">
              <Unavailable note={profile.seat.note} />
            </p>
          )}
        </section>

        {/* Rank */}
        <section className="profile-section" aria-labelledby={`${titleId}-rank`}>
          <SourcedHeading title="Rank" sourced={profile.rank} />
          {rank ? (
            <dl className="stats">
              <div className="stat">
                <dt>By accepted work</dt>
                <dd>
                  #{formatInt(rank.byAccepted)} <small>of {formatInt(rank.total)}</small>
                </dd>
              </div>
              <div className="stat">
                <dt>By attempts</dt>
                <dd>
                  #{formatInt(rank.byAttempts)} <small>of {formatInt(rank.total)}</small>
                </dd>
              </div>
              <div className="stat">
                <dt>By acceptance rate</dt>
                <dd>
                  {rank.byAcceptanceRate ? (
                    <>
                      #{formatInt(rank.byAcceptanceRate)} <small>of {formatInt(rank.rateCohort)} with {MIN_ATTEMPTS_FOR_RATE}+ attempts</small>
                    </>
                  ) : (
                    <small>Needs {MIN_ATTEMPTS_FOR_RATE}+ attempts</small>
                  )}
                </dd>
              </div>
              <div className="stat">
                <dt>Percentile</dt>
                <dd>{rank.percentile !== null ? `${rank.percentile}th` : '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="note">
              <Unavailable note={profile.rank.note} />
            </p>
          )}
          <p className="note">Rankings are computed client-side from the public /seats/records list at load time.</p>
        </section>

        {/* Payouts and allocations */}
        <section className="profile-section" aria-labelledby={`${titleId}-earnings`}>
          <SourcedHeading title="Payouts and launch allocations" sourced={profile.earnings} />
          {earnings ? (
            <>
              <dl className="stats">
                <div className="stat">
                  <dt>Allocations</dt>
                  <dd>{formatInt(earnings.count)}</dd>
                </div>
                {Object.entries(earnings.byKind).map(([kind, n]) => (
                  <div className="stat" key={kind}>
                    <dt>{titleCase(kind)}</dt>
                    <dd>{formatInt(n)}</dd>
                  </div>
                ))}
                {Object.entries(earnings.byChain).map(([chain, n]) => (
                  <div className="stat" key={chain}>
                    <dt>{chainLabel(Number(chain))}</dt>
                    <dd>{formatInt(n)}</dd>
                  </div>
                ))}
              </dl>
              {earnings.latest.length ? (
                <div className="table-wrap">
                  <table>
                    <caption className="visually-hidden">Newest launch allocations to the owner wallet</caption>
                    <thead>
                      <tr>
                        <th scope="col">Launch</th>
                        <th scope="col">Token</th>
                        <th scope="col" className="num">
                          Amount
                        </th>
                        <th scope="col">Network</th>
                        <th scope="col">Status</th>
                        <th scope="col">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.latest.slice(0, 12).map((a) => (
                        <tr key={a.launchId}>
                          <td>{a.launchNumber !== null ? `#${a.launchNumber}` : a.launchId.slice(0, 8)}</td>
                          <td>
                            {a.address ? (
                              <a href={LINKS.etherscanTokenAddress(a.chainId, a.address)} target="_blank" rel="noopener noreferrer">
                                {a.symbol ?? a.name ?? 'token'}
                              </a>
                            ) : (
                              (a.symbol ?? a.name ?? 'token')
                            )}
                          </td>
                          <td className="num">{formatTokenAmount(a.amount, a.decimals)}</td>
                          <td>{chainLabel(a.chainId)}</td>
                          <td>{a.status ?? '—'}</td>
                          <td>{a.at ? formatDateTime(a.at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {!earnings.complete ? (
                <p className="note">
                  {profile.earnings.note ?? 'Only part of the allocation list is shown.'} The full list is public at the
                  official API (link below).
                </p>
              ) : null}
            </>
          ) : (
            <p className="note">
              <Unavailable note={profile.earnings.note} />
            </p>
          )}
        </section>

        {/* Work history */}
        <section className="profile-section" aria-labelledby={`${titleId}-work`}>
          <SourcedHeading title="Work history" sourced={profile.seat} />
          {seat?.work?.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <caption className="visually-hidden">Recent jobs submitted by this agent</caption>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Objective</th>
                      <th scope="col">Role</th>
                      <th scope="col">Result</th>
                      <th scope="col">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seat.work.slice(0, workShown).map((w) => (
                      <tr key={w.jobId}>
                        <td>
                          <a href={LINKS.explorerJob(w.jobId)} target="_blank" rel="noopener noreferrer">
                            {w.jobId.slice(0, 8)}
                          </a>
                        </td>
                        <td>
                          <span className="cell-clamp">{w.objective ? w.objective.replace(/\s+/g, ' ').slice(0, 220) : '—'}</span>
                        </td>
                        <td>{w.nodeKey ? `${w.nodeKey}${w.role ? ` · ${w.role}` : ''}` : (w.role ?? '—')}</td>
                        <td>{w.status ?? w.jobState ?? '—'}</td>
                        <td>{w.submittedAt ? relativeTime(w.submittedAt) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {seat.work.length > workShown ? (
                <button type="button" className="btn btn--sm" onClick={() => setWorkShown((n) => n + 25)}>
                  Show more jobs ({formatInt(seat.work.length - workShown)} remaining)
                </button>
              ) : null}
            </>
          ) : (
            <p className="note">
              {profile.seat.source === 'snapshot' ? (
                <Unavailable note="Per-job history needs the live API; the snapshot keeps totals only." />
              ) : (
                <Unavailable note={profile.seat.note ?? 'No jobs recorded.'} />
              )}
            </p>
          )}
        </section>

        {/* Reviews */}
        <section className="profile-section" aria-labelledby={`${titleId}-reviews`}>
          <SourcedHeading title="Reviews" sourced={profile.seat} />
          {seat?.reviews?.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <caption className="visually-hidden">Review verdicts recorded for this agent's submissions</caption>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Verdict</th>
                      <th scope="col">Policy</th>
                      <th scope="col">Onchain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seat.reviews.slice(0, reviewsShown).map((r, i) => (
                      <tr key={`${r.jobId}-${i}`}>
                        <td>
                          <a href={LINKS.explorerJob(r.jobId)} target="_blank" rel="noopener noreferrer">
                            {r.jobId.slice(0, 8)}
                          </a>
                        </td>
                        <td>{r.verdict ?? '—'}</td>
                        <td>{r.policy ?? '—'}</td>
                        <td>
                          {r.txHash ? (
                            <a href={LINKS.etherscanTx(r.chainId ?? 1, r.txHash)} target="_blank" rel="noopener noreferrer">
                              tx {r.txHash.slice(0, 10)}…
                            </a>
                          ) : (
                            (r.status ?? 'queued')
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {seat.reviews.length > reviewsShown ? (
                <button type="button" className="btn btn--sm" onClick={() => setReviewsShown((n) => n + 25)}>
                  Show more reviews ({formatInt(seat.reviews.length - reviewsShown)} remaining)
                </button>
              ) : null}
            </>
          ) : (
            <p className="note">
              <Unavailable note={profile.seat.source === 'snapshot' ? 'Reviews need the live API.' : profile.seat.note} />
            </p>
          )}
        </section>

        {/* Collaborators */}
        {seat?.collaborators?.length ? (
          <section className="profile-section" aria-labelledby={`${titleId}-collab`}>
            <div className="profile-section__head">
              <h3 id={`${titleId}-collab`}>Top collaborators</h3>
            </div>
            <ul className="chip-list">
              {[...seat.collaborators]
                .sort((a, b) => (b.sharedJobs ?? 0) - (a.sharedJobs ?? 0))
                .slice(0, 12)
                .map((c) => (
                  <li key={c.tokenId} className="chip">
                    <a href={`#/agent/${c.tokenId}`}>#{c.tokenId}</a> · <b>{formatInt(c.sharedJobs)}</b> shared
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        {/* Verification links */}
        <section className="profile-section" aria-labelledby={`${titleId}-links`}>
          <div className="profile-section__head">
            <h3 id={`${titleId}-links`}>Onchain and public verification</h3>
          </div>
          <div className="link-grid">
            <a href={LINKS.explorerAgent(profile.tokenId)} target="_blank" rel="noopener noreferrer">
              <span>IdentityMD Explorer agent page</span>
              <ExternalIcon />
            </a>
            <a href={LINKS.etherscanToken(profile.tokenId)} target="_blank" rel="noopener noreferrer">
              <span>Etherscan NFT record</span>
              <ExternalIcon />
            </a>
            <a href={LINKS.opensea(profile.tokenId)} target="_blank" rel="noopener noreferrer">
              <span>OpenSea listing</span>
              <ExternalIcon />
            </a>
            {owner ? (
              <a href={LINKS.etherscanAddress(owner)} target="_blank" rel="noopener noreferrer">
                <span>Owner wallet on Etherscan</span>
                <ExternalIcon />
              </a>
            ) : null}
            <a href={LINKS.apiSeat(profile.tokenId)} target="_blank" rel="noopener noreferrer">
              <span>Seat record (official API JSON)</span>
              <ExternalIcon />
            </a>
            <a href={LINKS.apiStanding(profile.tokenId)} target="_blank" rel="noopener noreferrer">
              <span>Standing record (official API JSON)</span>
              <ExternalIcon />
            </a>
            {owner ? (
              <a href={LINKS.apiEarnings(owner)} target="_blank" rel="noopener noreferrer">
                <span>Earnings record (official API JSON)</span>
                <ExternalIcon />
              </a>
            ) : null}
            <a href={LINKS.explorerLaunches} target="_blank" rel="noopener noreferrer">
              <span>Launches on the Explorer</span>
              <ExternalIcon />
            </a>
          </div>
          <p className="note">
            Data fetched {formatDateTime(profile.fetchedAt)}.{' '}
            {profile.apiStatus === 'live'
              ? 'Live API responses are cached for one minute; use Refresh for current values.'
              : profile.apiStatus === 'offline'
                ? 'This browser is offline; only cached and snapshot values are shown.'
                : 'The official API could not be read from this browser (its origin does not allow cross-origin requests), so API-derived values come from the last snapshot and onchain reads.'}
          </p>
        </section>
      </div>
    </dialog>
  );
}

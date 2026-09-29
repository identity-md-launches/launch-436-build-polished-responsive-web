import type { CSSProperties, MouseEvent } from 'react';
import type { CardModel } from '../lib/cardModel';
import { stateTiming } from '../lib/cardModel';
import { QrCode } from './common';

interface Props {
  model: CardModel;
  onOpen?: () => void;
  staticRender?: boolean;
}

/**
 * The animated SIMCARD. The container is a pointer convenience: clicking
 * anywhere opens the profile, while keyboard users reach the same action
 * through the explicit "Open profile" button beside the card.
 */
export function SimCard({ model, onOpen, staticRender = false }: Props) {
  const timing = stateTiming(model.state);
  const style = {
    '--card-accent': model.palette.primary,
    '--card-accent-2': model.palette.secondary,
    '--card-accent-3': model.palette.tertiary,
    '--card-accent-text': model.palette.text,
    '--orbit-duration': `${timing.orbit}s`,
    '--pulse-duration': `${timing.pulse}s`,
    '--scan-duration': `${timing.scan}s`,
    '--card-dim': timing.dim,
    '--status-color':
      model.state === 'working'
        ? 'var(--color-status-working)'
        : model.state === 'ready' || model.state === 'online'
          ? 'var(--color-status-ready)'
          : model.state === 'offline'
            ? 'var(--color-status-offline)'
            : 'var(--color-status-unknown)',
  } as CSSProperties;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    onOpen?.();
  };

  return (
    <div className="simcard-frame">
      <article
        className={`simcard simcard--${model.state}${staticRender ? ' simcard--static' : ''}${!onOpen ? ' simcard--display' : ''}`}
        style={style}
        onClick={handleClick}
        aria-label={`SIMCARD for identity.md ${model.number}. ${model.stateLabel}.${onOpen ? ' Select to open the full profile.' : ''}`}
        data-testid="simcard"
      >
        <span className="simcard__chip" aria-hidden="true" />
        <div className="simcard__art">
          {model.image ? (
            <img className="simcard__img" src={model.image} alt={model.imageAlt} decoding="async" />
          ) : (
            <p className="simcard__art-missing">Artwork unavailable for this token.</p>
          )}
          <div className="simcard__layer" aria-hidden="true">
            <svg className="simcard__orbit simcard__orbit--a" viewBox="0 0 100 100" fill="none">
              <ellipse cx="50" cy="50" rx="46" ry="20" stroke={model.palette.primary} strokeOpacity="0.55" strokeWidth="0.6" />
              <ellipse
                cx="50"
                cy="50"
                rx="36"
                ry="44"
                transform="rotate(60 50 50)"
                stroke={model.palette.secondary}
                strokeOpacity="0.45"
                strokeWidth="0.5"
              />
              <circle cx="96" cy="50" r="1.4" fill={model.palette.tertiary} />
            </svg>
            <svg className="simcard__orbit simcard__orbit--b" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="47" stroke={model.palette.tertiary} strokeOpacity="0.35" strokeWidth="0.4" strokeDasharray="3 5" />
            </svg>
            <span className="simcard__pulse" />
            <span className="simcard__scan" />
            <span className="simcard__live" />
          </div>
        </div>

        <div className="simcard__body">
          <header className="simcard__head">
            <div className="simcard__id">
              <span className="simcard__label">identity.md NFT</span>
              <span className="simcard__number">{model.number}</span>
              <span className="simcard__name">{model.name}</span>
            </div>
          </header>

          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            <div className="cluster" style={{ gap: 'var(--space-2)' }}>
              <span className={`badge badge--${model.state}`}>
                <span className="badge__dot" aria-hidden="true" />
                {model.stateLabel}
              </span>
              <span className="badge" style={{ color: model.verified ? model.palette.text : undefined }}>
                {model.verification}
              </span>
            </div>
            <dl className="simcard__grid">
              {model.fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd className={field.unavailable ? 'unavailable' : undefined}>{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <footer className="simcard__foot">
            <div className="simcard__meta">
              <span>
                Network <b>{model.network}</b>
              </span>
              <span>
                Last activity <b>{model.lastActivity}</b>
              </span>
              <span>{model.dataLabel}</span>
              <span>Scan for the public profile</span>
            </div>
            <div className="simcard__qr">
              <QrCode value={model.shareUrl} size={60} />
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}

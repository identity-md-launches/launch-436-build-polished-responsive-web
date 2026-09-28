import { useId, useState, type FormEvent } from 'react';
import { MAX_TOKEN_ID, MIN_TOKEN_ID } from '../data/config';
import { parseTokenId } from '../data/profile';
import { agentHash, navigate } from '../router';

interface Props {
  initialValue?: string;
  compact?: boolean;
  autoFocus?: boolean;
}

export function SearchForm({ initialValue = '', compact = false, autoFocus = false }: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const tokenId = parseTokenId(value);
    if (tokenId === null) {
      setError(`Enter a whole number between ${MIN_TOKEN_ID} and ${MAX_TOKEN_ID}, such as 222.`);
      const input = document.getElementById(inputId);
      input?.focus();
      return;
    }
    setError(null);
    navigate(agentHash(tokenId));
  };

  return (
    <form className="search" onSubmit={submit} noValidate role="search" aria-label="Find an IdentityMD agent by NFT token ID">
      <label className="search__label" htmlFor={inputId}>
        {compact ? 'Token ID' : 'IdentityMD NFT token ID'}
      </label>
      <div className="search__row">
        <input
          id={inputId}
          className="search__input"
          name="tokenId"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="go"
          placeholder="222"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? 'true' : undefined}
          autoFocus={autoFocus}
        />
        <button type="submit" className="btn btn--primary" style={{ minHeight: compact ? undefined : '3.25rem' }}>
          Generate SIMCARD
        </button>
      </div>
      <p id={hintId} className="search__hint">
        {compact ? `Numbers ${MIN_TOKEN_ID}–${MAX_TOKEN_ID}.` : `Any identity.md token from ${MIN_TOKEN_ID} to ${MAX_TOKEN_ID}. No wallet needed.`}
      </p>
      {error ? (
        <p id={errorId} className="search__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

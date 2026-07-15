'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/atoms/Button';

export interface JoinModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (roomId: string) => void;
}

export function JoinModal({ open, onClose, onSubmit }: JoinModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const id = value.trim().toUpperCase();
    if (id.length !== 6) {
      setError('6文字の部屋IDを入力してください');
      return;
    }
    onSubmit(id);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="join-title">
        <h2 id="join-title">部屋に入る</h2>
        <p className="modal-help">相手から共有された部屋IDを入力してください。</p>
        <input
          ref={inputRef}
          className="code-input"
          maxLength={6}
          autoComplete="off"
          placeholder="ABC123"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="primary" onClick={submit}>
            入室する
          </Button>
        </div>
      </div>
    </div>
  );
}

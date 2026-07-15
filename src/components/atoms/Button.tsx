'use client';

import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
}

export function Button({ variant = 'ghost', small = false, className = '', ...rest }: ButtonProps) {
  const cls = ['btn', variant === 'primary' ? 'btn-primary' : 'btn-ghost', small ? 'btn-small' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button className={cls} {...rest} />;
}

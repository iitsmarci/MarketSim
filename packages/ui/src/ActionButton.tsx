import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: 'primary' | 'secondary';
}

export function ActionButton({
  children,
  className = '',
  tone = 'primary',
  type = 'button',
  ...props
}: ActionButtonProps) {
  const classes = ['ms-action', `ms-action--${tone}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}

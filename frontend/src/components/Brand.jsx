import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Brand({ to = '/' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2.5 text-neutral-900 no-underline hover:opacity-85 transition-opacity"
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded border border-neutral-900 bg-neutral-900 text-white">
        <ShieldCheck className="w-5 h-5" />
      </span>
      <div className="flex flex-col">
        <span className="text-lg font-bold tracking-tight leading-none text-neutral-900">
          OpenCargo
        </span>
        <span className="text-[11px] text-neutral-500 font-medium tracking-wide uppercase mt-0.5">
          Controle de Acesso Industrial
        </span>
      </div>
    </Link>
  );
}

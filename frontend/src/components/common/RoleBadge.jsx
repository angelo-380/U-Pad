import React from 'react';
import { Shield, Briefcase, HeartHandshake } from 'lucide-react';

export const RoleBadge = ({ role, className = '' }) => {
  const normalizedRole = role ? role.toLowerCase() : 'anónimo';

  const roleConfigs = {
    admin: {
      label: 'Administrador',
      icon: Shield,
      bg: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    empresario: {
      label: 'Empresario',
      icon: Briefcase,
      bg: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    tutor: {
      label: 'Tutor / Familiar',
      icon: HeartHandshake,
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
  };

  const config = roleConfigs[normalizedRole] || {
    label: normalizedRole,
    icon: Shield,
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border tracking-wide uppercase ${config.bg} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
};

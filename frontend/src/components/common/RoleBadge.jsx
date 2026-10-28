import React from 'react';
import { Shield, Briefcase, HeartHandshake } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const RoleBadge = ({ role, className = '' }) => {
  const { t } = useLanguage();
  const normalizedRole = role ? role.toLowerCase() : 'anónimo';

  const roleConfigs = {
    admin: {
      label: t('role_admin'),
      icon: Shield,
      bg: 'bg-purple-50 text-purple-900 border-purple-200/80',
    },
    empresario: {
      label: t('role_empresario'),
      icon: Briefcase,
      bg: 'bg-teal-50 text-teal-900 border-teal-200/80',
    },
    tutor: {
      label: t('role_tutor'),
      icon: HeartHandshake,
      bg: 'bg-amber-50 text-amber-900 border-amber-200/80',
    },
  };

  const config = roleConfigs[normalizedRole] || {
    label: t('role_anonymous'),
    icon: Shield,
    bg: 'bg-tea-cardSubtle text-tea-muted border-tea-border',
  };

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

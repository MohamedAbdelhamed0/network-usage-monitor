import React from 'react';
import {
  Globe,
  Shield,
  Code,
  Terminal,
  Gamepad2,
  Music,
  Cpu,
  Layers,
  MessageSquare,
} from 'lucide-react';

interface AppIconProps {
  name: string;
  isSystem: boolean;
  iconBase64?: string | null;
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  isSystem,
  iconBase64,
  className = 'w-7 h-7',
}) => {
  if (iconBase64 && iconBase64.startsWith('data:image')) {
    return (
      <img
        src={iconBase64}
        alt={name}
        className={`${className} object-contain rounded-md filter drop-shadow`}
        onError={(e) => {
          // If image fails, hide it and allow fallback to render
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  const lower = name.toLowerCase();

  // Pick semantic fallback icon
  let IconComponent = Layers;
  let bgGradient = 'from-slate-600 to-slate-800';

  if (isSystem || lower.includes('system') || lower.includes('svchost') || lower.includes('service')) {
    IconComponent = Shield;
    bgGradient = 'from-blue-600 to-indigo-800';
  } else if (lower.includes('chrome') || lower.includes('edge') || lower.includes('firefox') || lower.includes('brave') || lower.includes('browser')) {
    IconComponent = Globe;
    bgGradient = 'from-cyan-600 to-blue-800';
  } else if (lower.includes('code') || lower.includes('devenv') || lower.includes('git') || lower.includes('studio')) {
    IconComponent = Code;
    bgGradient = 'from-violet-600 to-purple-900';
  } else if (lower.includes('cmd') || lower.includes('powershell') || lower.includes('terminal') || lower.includes('bash')) {
    IconComponent = Terminal;
    bgGradient = 'from-emerald-600 to-teal-900';
  } else if (lower.includes('steam') || lower.includes('game') || lower.includes('epic') || lower.includes('riot')) {
    IconComponent = Gamepad2;
    bgGradient = 'from-amber-600 to-orange-800';
  } else if (lower.includes('spotify') || lower.includes('music') || lower.includes('discord') || lower.includes('telegram')) {
    IconComponent = lower.includes('music') || lower.includes('spotify') ? Music : MessageSquare;
    bgGradient = 'from-pink-600 to-rose-900';
  } else if (lower.includes('kernel') || lower.includes('dwm')) {
    IconComponent = Cpu;
    bgGradient = 'from-sky-700 to-slate-900';
  }

  return (
    <div
      className={`${className} rounded-lg bg-gradient-to-br ${bgGradient} flex items-center justify-center p-1.5 shadow-md border border-white/10 flex-shrink-0`}
    >
      <IconComponent className="w-full h-full text-white/90" />
    </div>
  );
};

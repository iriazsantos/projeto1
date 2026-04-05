/**
 * Componentes UI Reutilizáveis - Design System Moderno
 * INOVATECH CONNECT 2025
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

// ============================================
// CARD COMPONENTS
// ============================================

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'gradient' | 'elevated';
  gradient?: string;
  hover?: boolean;
}

export function Card({ children, variant = 'default', gradient, hover = true, className, ...props }: CardProps) {
  const baseStyles = 'rounded-2xl transition-all duration-300';
  
  const variants = {
    default: 'bg-white border border-slate-200 shadow-sm',
    glass: 'bg-white/80 backdrop-blur-lg border border-white/20 shadow-lg',
    gradient: `bg-gradient-to-br ${gradient || 'from-slate-50 to-gray-100'} border border-slate-200/50 shadow-md`,
    elevated: 'bg-white border border-slate-100 shadow-xl',
  };

  const hoverStyles = hover ? 'hover:shadow-xl hover:-translate-y-1 hover:border-slate-300' : '';

  return (
    <div className={twMerge(baseStyles, variants[variant], hoverStyles, className)} {...props}>
      {children}
    </div>
  );
}

// ============================================
// METRIC CARD
// ============================================

interface MetricCardProps {
  icon: string | React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral' | 'none';
  trendValue?: string;
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'cyan' | 'indigo' | 'rose' | 'amber';
  size?: 'sm' | 'md' | 'lg';
}

const colorVariants = {
  blue: { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-500/20' },
  purple: { gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', ring: 'ring-violet-500/20' },
  green: { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'ring-emerald-500/20' },
  orange: { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', ring: 'ring-orange-500/20' },
  red: { gradient: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', ring: 'ring-rose-500/20' },
  cyan: { gradient: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', ring: 'ring-cyan-500/20' },
  indigo: { gradient: 'from-indigo-500 to-violet-600', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'ring-indigo-500/20' },
  rose: { gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', ring: 'ring-pink-500/20' },
  amber: { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500/20' },
};

export function MetricCard({ icon, label, value, sub, trend, trendValue, color = 'blue', size = 'md' }: MetricCardProps) {
  const colors = colorVariants[color];
  const sizes = {
    sm: { icon: 'w-10 h-10', value: 'text-xl', padding: 'p-4' },
    md: { icon: 'w-12 h-12', value: 'text-2xl', padding: 'p-5' },
    lg: { icon: 'w-14 h-14', value: 'text-3xl', padding: 'p-6' },
  };

  return (
    <Card hover className={twMerge('relative overflow-hidden', sizes[size].padding)}>
      <div className="flex items-start justify-between mb-4">
        <div className={`rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center ${sizes[size].icon} text-xl shadow-lg ring-4 ${colors.ring}`}>
          {icon}
        </div>
        {trend && trend !== 'none' && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
            trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
            trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            {trendValue && <span className="ml-0.5">{trendValue}</span>}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-slate-500">{label}</p>
        <p className={`${sizes[size].value} font-bold text-slate-800 transition-all`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
      </div>

      {/* Decorative gradient orb */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br ${colors.gradient} opacity-5 rounded-full blur-2xl`} />
    </Card>
  );
}

// ============================================
// BADGE COMPONENT
// ============================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  icon?: string;
}

export function Badge({ children, variant = 'default', size = 'md', icon }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span className={twMerge(
      'inline-flex items-center gap-1 font-bold rounded-full border transition-all',
      variants[variant],
      sizes[size]
    )}>
      {icon && <span className="text-[0.9em]">{icon}</span>}
      {children}
    </span>
  );
}

// ============================================
// BUTTON COMPONENT
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
}

export function Button({ children, variant = 'primary', size = 'md', icon, loading, className, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-500/25',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={twMerge(
        'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {icon && !loading && <span className="text-lg">{icon}</span>}
      {children}
    </button>
  );
}

// ============================================
// PROGRESS BAR
// ============================================

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gradient' | 'cyan' | 'indigo' | 'amber' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({ value, max = 100, color = 'blue', size = 'md', showLabel, label }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    gradient: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500',
    cyan: 'bg-cyan-500',
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
          {showLabel && <span className="text-xs font-bold text-slate-700">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// SKELETON LOADER
// ============================================

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect' | 'card';
  className?: string;
}

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  const variants = {
    text: 'h-4 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
    card: 'rounded-2xl',
  };

  return (
    <div
      className={twMerge(
        'animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%]',
        variants[variant],
        className
      )}
    />
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-5xl mb-4 animate-bounce">{icon}</div>
      <h3 className="text-lg font-bold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}

// ============================================
// SECTION HEADER
// ============================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, icon, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg shadow-md">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ============================================
// STATS ROW
// ============================================

interface StatsRowProps {
  label: string;
  value: string | number | React.ReactNode;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatsRow({ label, value, icon, trend }: StatsRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {typeof value === 'string' || typeof value === 'number' ? (
          <span className="text-sm font-bold text-slate-800">{value}</span>
        ) : (
          value
        )}
        {trend && (
          <span className={`text-xs ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// ACTIVITY ITEM
// ============================================

interface ActivityItemProps {
  icon: string | React.ReactNode;
  title: string;
  time?: string;
  description?: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'none';
  onClick?: () => void;
}

export function ActivityItem({ icon, title, time, description, status = 'none', onClick }: ActivityItemProps) {
  const statusConfig = {
    success: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓' },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '!' },
    error: { bg: 'bg-red-100', text: 'text-red-700', icon: '✕' },
    info: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'i' },
    none: null,
  };

  const config = status !== 'none' ? statusConfig[status] : null;

  return (
    <div
      onClick={onClick}
      className={twMerge(
        'flex items-start gap-3 p-3 rounded-xl transition-all duration-200 group cursor-pointer',
        onClick ? 'hover:bg-slate-50' : ''
      )}
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 group-hover:shadow-md transition-all">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{title}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        {time && <p className="text-xs text-slate-400 mt-1">{time}</p>}
      </div>
      {config && (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
          {config.icon}
        </span>
      )}
    </div>
  );
}

// ============================================
// TABS COMPONENT
// ============================================

interface TabsProps {
  tabs: { id: string; label: string; icon?: string }[];
  activeTab: string;
  onChange: (tab: string) => void;
  variant?: 'default' | 'pills' | 'underline';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'pills' }: TabsProps) {
  const variants = {
    pills: 'gap-1 bg-slate-100 p-1 rounded-xl',
    underline: 'gap-6 border-b border-slate-200',
    default: 'gap-2',
  };

  return (
    <div className={twMerge('flex', variants[variant])}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        
        if (variant === 'pills') {
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={twMerge(
                'px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1.5',
                isActive
                  ? 'bg-white text-slate-800 shadow-md'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
              )}
            >
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </button>
          );
        }

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={twMerge(
                'pb-3 text-sm font-bold transition-all duration-200 relative',
                isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-800'
              )}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={twMerge(
              'px-3 py-1.5 text-sm font-bold rounded-lg transition-all duration-200',
              isActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  Card,
  MetricCard,
  Badge,
  Button,
  ProgressBar,
  Skeleton,
  EmptyState,
  SectionHeader,
  StatsRow,
  ActivityItem,
  Tabs,
};

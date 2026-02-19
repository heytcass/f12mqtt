const FLAG_COLORS: Record<string, string> = {
  green: 'bg-green-600',
  yellow: 'bg-yellow-500',
  red: 'bg-red-600',
  sc: 'bg-yellow-400',
  vsc: 'bg-yellow-400',
  vsc_ending: 'bg-yellow-300',
  chequered: 'bg-white',
};

const FLAG_LABELS: Record<string, string> = {
  green: 'Green Flag',
  yellow: 'Yellow Flag',
  red: 'Red Flag',
  sc: 'Safety Car',
  vsc: 'Virtual Safety Car',
  vsc_ending: 'VSC Ending',
  chequered: 'Chequered Flag',
};

interface FlagIndicatorProps {
  flag: string;
}

export function FlagIndicator({ flag }: FlagIndicatorProps) {
  if (flag === 'green') return null;

  const bgColor = FLAG_COLORS[flag] ?? 'bg-gray-600';
  const label = FLAG_LABELS[flag] ?? flag;
  const textColor = flag === 'chequered' ? 'text-gray-900' : 'text-white';

  return (
    <div className={`${bgColor} ${textColor} text-center py-1.5 text-sm font-bold tracking-wide animate-pulse`}>
      {label}
    </div>
  );
}

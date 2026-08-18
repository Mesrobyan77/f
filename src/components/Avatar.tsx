interface AvatarProps {
  initials: string;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const colorMap: Record<string, string> = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-purple-500',
  D: 'bg-orange-500',
  E: 'bg-pink-500',
  F: 'bg-teal-500',
};

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function Avatar({ initials, online, size = 'md' }: AvatarProps) {
  const firstLetter = initials.charAt(0).toUpperCase();
  const bgColor = colorMap[firstLetter] || 'bg-gray-500';

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${bgColor} ${sizeMap[size]} rounded-full flex items-center justify-center text-white font-semibold`}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
            online ? 'bg-green-400' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
}

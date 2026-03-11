// Logo component for NotesMitra
interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

export const Logo = ({ className = '', size = 'md' }: LogoProps) => {
  return (
    <img 
      src="/logo.png" 
      alt="NotesMitra Logo" 
      className={`${sizeMap[size]} ${className}`}
    />
  );
};

export default Logo;

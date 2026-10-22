import { Egg, Fish, Bird } from 'lucide-react';
import DuckIcon from '@/components/DuckIcon';

/** Symbol for a poultry or fish batch: shown instead of a photo. */
export default function BatchIcon({ type, size = 18, className = '' }: { type?: string | null; size?: number; className?: string }) {
  if (type === 'DUCK') return <DuckIcon size={size + 2} className={className} />;
  if (type === 'FISH') return <Fish size={size} className={className} />;
  if (type === 'QUAIL') return <Bird size={size} className={className} />;
  return <Egg size={size} className={className} />;
}

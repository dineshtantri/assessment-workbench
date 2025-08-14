import React, { useState, useEffect } from 'react';
import { useAuthContext } from '~/hooks';
import { cn } from '~/utils';

interface PersonalityOption {
  id: string;
  name: string;
  description: string;
}

interface InlinePersonalitySelectorProps {
  onPersonalityChange: (personalityId: string) => void;
  currentPersonality: string;
  className?: string;
}

const InlinePersonalitySelector: React.FC<InlinePersonalitySelectorProps> = ({ 
  onPersonalityChange, 
  currentPersonality, 
  className 
}) => {
  const [personalities, setPersonalities] = useState<PersonalityOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthContext();

  useEffect(() => {
    const fetchPersonalities = async () => {
      try {
        console.log('[InlinePersonalitySelector] Fetching personalities...');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch('/api/personality/profiles', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('[InlinePersonalitySelector] Fetched personalities:', data);
        
        setPersonalities(data.personalities || []);
        setIsLoading(false);
      } catch (error) {
        console.error('[InlinePersonalitySelector] Error fetching personalities:', error);
        setError(error instanceof Error ? error.message : 'Failed to load personalities');
        setIsLoading(false);
      }
    };

    fetchPersonalities();
  }, [token]);

  const handlePersonalityChange = (personalityId: string) => {
    console.log('[InlinePersonalitySelector] Personality changed to:', personalityId);
    onPersonalityChange(personalityId);
    
    // Store in localStorage for persistence
    localStorage.setItem('selectedPersonality', personalityId);
    
    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent('personalityChanged', { 
      detail: { personalityId } 
    }));
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleSelectFocus = (e: React.FocusEvent) => {
    e.stopPropagation();
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-text-secondary", className)}>
        <div className="animate-pulse w-4 h-4 bg-border-light rounded"></div>
        <span>Loading personalities...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-red-500", className)}>
        <span>⚠️ {error}</span>
      </div>
    );
  }

  const currentPersonalityData = personalities.find(p => p.id === currentPersonality);

  return (
    <div className={cn("flex items-center gap-2", className)} style={{ position: 'relative', zIndex: 1000 }}>
      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
        <span className="text-[10px] font-medium uppercase tracking-wide">AI Personality:</span>
        <select
          value={currentPersonality}
          onChange={(e) => handlePersonalityChange(e.target.value)}
          onClick={handleSelectClick}
          onFocus={handleSelectFocus}
          onMouseDown={(e) => e.stopPropagation()}
          className={cn(
            "text-xs font-medium cursor-pointer rounded px-2 py-1",
            "bg-surface-secondary border border-border-light",
            "text-text-primary hover:bg-surface-tertiary transition-colors",
            "focus:outline-none focus:ring-1 focus:ring-blue-500",
            "min-w-[120px]"
          )}
          style={{ zIndex: 1000 }}
        >
          {personalities.map((personality) => (
            <option 
              key={personality.id} 
              value={personality.id}
              style={{ backgroundColor: 'var(--surface-primary)', color: 'var(--text-primary)' }}
            >
              {personality.name}
            </option>
          ))}
        </select>
      </div>
      {currentPersonalityData && (
        <div className="text-[10px] text-text-tertiary max-w-48 truncate">
          {currentPersonalityData.description}
        </div>
      )}
    </div>
  );
};

export default InlinePersonalitySelector;
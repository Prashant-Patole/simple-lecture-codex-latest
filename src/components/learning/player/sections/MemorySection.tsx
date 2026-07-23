import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { PresentationSection, FlashCard } from '../types';
import { cn } from '@/lib/utils';
import { ContentRenderer } from '../ContentRenderer';

interface MemorySectionProps {
  section: PresentationSection;
  revealedIndices: number[];
  currentTime: number;
  totalDuration: number;
  isMobile?: boolean;
}

interface FlashCardComponentProps {
  card: FlashCard;
  isRevealed: boolean;
  isFlipped: boolean;
  onFlip: () => void;
}

const FlashCardComponent = ({ card, isRevealed, isFlipped, onFlip }: FlashCardComponentProps) => {
  return (
    <div
      className={cn(
        "flashcard",
        isRevealed && "revealed",
        isFlipped && "flipped"
      )}
      onClick={onFlip}
    >
      <div className="flashcard-inner">
        {/* Front - Question */}
        <div className="flashcard-face flashcard-front">
          <span className="flashcard-label">Question</span>
          <div className="flashcard-content">
            <ContentRenderer 
              content={card.front} 
              type="markdown"
            />
          </div>
          
        </div>

        {/* Back - Answer */}
        <div className="flashcard-face flashcard-back">
          <span className="flashcard-label">Answer</span>
          <div className="flashcard-content">
            <ContentRenderer 
              content={card.back} 
              type="markdown"
            />
          </div>
          
        </div>
      </div>
    </div>
  );
};

export const MemorySection = ({
  section,
  revealedIndices,
  currentTime,
  totalDuration,
  isMobile = false,
}: MemorySectionProps) => {
  const flashcards = section.flashcards || [];
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Calculate active card index from timing
  const activeCardIndex = useMemo(() => {
    if (flashcards.length === 0 || totalDuration === 0) return 0;
    const timePerCard = totalDuration / flashcards.length;
    const index = Math.floor(currentTime / timePerCard);
    return Math.min(index, flashcards.length - 1);
  }, [currentTime, totalDuration, flashcards.length]);

  // Auto-scroll to active card on mobile
  useEffect(() => {
    if (!isMobile) return;
    const el = cardRefs.current[activeCardIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeCardIndex, isMobile]);

  // Auto-flip logic based on timing
  useEffect(() => {
    if (flashcards.length === 0 || totalDuration === 0) return;

    const timePerCard = totalDuration / flashcards.length;

    flashcards.forEach((_card, index) => {
      const cardStartTime = index * timePerCard;
      const flipTime = cardStartTime + (timePerCard * 0.5);

      if (currentTime >= flipTime && !flippedCards.has(index)) {
        setFlippedCards(prev => new Set([...prev, index]));
      }
    });
  }, [currentTime, totalDuration, flashcards, flippedCards]);

  // Calculate which cards should be revealed based on timing
  const revealedCardIndices = useMemo(() => {
    if (flashcards.length === 0 || totalDuration === 0) return [];
    
    const timePerCard = totalDuration / flashcards.length;
    const revealed: number[] = [];
    
    flashcards.forEach((_, index) => {
      const cardStartTime = index * timePerCard;
      if (currentTime >= cardStartTime) {
        revealed.push(index);
      }
    });
    
    return revealed;
  }, [currentTime, totalDuration, flashcards]);

  const handleFlip = useCallback((index: number) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Reset flipped cards when section changes
  useEffect(() => {
    setFlippedCards(new Set());
  }, [section.section_id]);

  // Ref callback for card elements
  const setCardRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    cardRefs.current[index] = el;
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Section Title */}
      <h2 className="section-title">{section.title}</h2>
      <p className={cn("opacity-70", isMobile ? "text-[0.5rem] mb-1 px-2" : "text-sm mb-4 px-4")}>
        Test your understanding with these flashcards
      </p>

      {/* Flashcard Grid */}
      <div className={cn("flashcard-grid", !isMobile && "content-box")}>
        {flashcards.map((card, index) => (
          <div key={card.card_id ?? `card-${index}`} ref={setCardRef(index)}>
            <FlashCardComponent
              card={card}
              isRevealed={revealedCardIndices.includes(index)}
              isFlipped={flippedCards.has(index)}
              onFlip={() => handleFlip(index)}
            />
          </div>
        ))}
      </div>


      {/* Progress */}
      <div className={cn("mt-4 text-center opacity-70", isMobile ? "text-[0.5rem]" : "text-sm")}>
        {flippedCards.size} of {flashcards.length} cards reviewed
      </div>
    </div>
  );
};

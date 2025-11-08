import { useRef, useCallback } from 'react';

export const useScrollOptimizer = (width, onIndexChange) => {
  const isScrolling = useRef(false);
  const scrollTimeout = useRef(null);

  const handleScroll = useCallback((event) => {
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    isScrolling.current = true;

    // Aguarda um pequeno delay para atualizar o índice
    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false;
      onIndexChange(newIndex);
    }, 50);
  }, [width, onIndexChange]);

  const isCurrentlyScrolling = useCallback(() => {
    return isScrolling.current;
  }, []);

  return {
    handleScroll,
    isCurrentlyScrolling,
  };
};
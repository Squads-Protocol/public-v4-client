import { type ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState('page-transition');

  useEffect(() => {
    if (children !== displayChildren) {
      setTransitionStage('fade-in');
      // Small delay to allow fade out before setting new children
      const timeout = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('page-transition');
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [children, displayChildren]);

  return (
    <div key={location.pathname} className={transitionStage}>
      {displayChildren}
    </div>
  );
}

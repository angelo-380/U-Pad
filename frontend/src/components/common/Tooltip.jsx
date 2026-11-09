import React, { useState, useId } from 'react';

/**
 * Componente Tooltip accesible (WCAG AA).
 * Se activa mediante hover del cursor y foco del teclado (onFocus).
 */
export const Tooltip = ({
  content,
  children,
  position = 'bottom',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position] || 'top-full left-1/2 -translate-x-1/2 mt-2';

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            'aria-describedby': isVisible ? tooltipId : undefined,
          })
        : children}

      {isVisible && content && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute ${positionClasses} z-50 pointer-events-none px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-900/95 rounded-xl shadow-lg border border-slate-700/50 backdrop-blur-xs whitespace-nowrap transition-opacity duration-150 animate-fadeIn motion-reduce:animate-none`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

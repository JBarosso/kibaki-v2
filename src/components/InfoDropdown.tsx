import React, { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoDropdownProps {
  links: Array<{ href: string; label: string }>;
  infoText: string;
}

export default function InfoDropdown({ links, infoText }: InfoDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="site-nav__info-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`site-nav__info-summary ${isOpen ? 'site-nav__info-summary--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Info className="site-nav__info-icon" aria-hidden="true" size={18} />
      </button>

      {isOpen && (
        <div className="site-nav__info-content">
          <ul className="site-nav__info-list">
            {links.map((link) => (
              <li key={link.href} className="site-nav__info-item">
                <a className="site-nav__info-link" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="site-nav__info-text">{infoText}</p>
        </div>
      )}
    </div>
  );
}

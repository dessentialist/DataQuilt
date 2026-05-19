import { useEffect, useState, useRef } from 'react';

export interface Section {
  id: string;
  label: string;
  subsections?: { id: string; label: string }[];
}

export function useScrollSpy(sections: Section[], offset: number = 100) {
  const [activeSection, setActiveSection] = useState<string>('');
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Create intersection observer to detect which section is in view
    observer.current = new IntersectionObserver(
      (entries) => {
        // Find the first entry that is intersecting
        const intersectingEntry = entries.find(entry => entry.isIntersecting);
        
        if (intersectingEntry) {
          // Set active section based on the intersecting element's ID
          setActiveSection(intersectingEntry.target.id);
        } else {
          // If no sections are intersecting, find the closest one above the viewport
          const scrollPosition = window.scrollY + offset;
          
          for (let i = sections.length - 1; i >= 0; i--) {
            const element = document.getElementById(sections[i].id);
            if (element && element.offsetTop <= scrollPosition) {
              setActiveSection(sections[i].id);
              break;
            }
            
            // Check subsections too
            if (sections[i].subsections) {
              for (let j = sections[i].subsections!.length - 1; j >= 0; j--) {
                const subElement = document.getElementById(sections[i].subsections![j].id);
                if (subElement && subElement.offsetTop <= scrollPosition) {
                  setActiveSection(sections[i].subsections![j].id);
                  break;
                }
              }
            }
          }
        }
      },
      {
        rootMargin: `-${offset}px 0px -50% 0px`,
        threshold: 0
      }
    );

    // Observe all sections and subsections
    sections.forEach(section => {
      const element = document.getElementById(section.id);
      if (element && observer.current) {
        observer.current.observe(element);
      }
      
      // Observe subsections if they exist
      section.subsections?.forEach(subsection => {
        const subElement = document.getElementById(subsection.id);
        if (subElement && observer.current) {
          observer.current.observe(subElement);
        }
      });
    });

    // Set initial active section
    const handleScroll = () => {
      const scrollPosition = window.scrollY + offset;
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i].id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i].id);
          return;
        }
        
        // Check subsections too
        if (sections[i].subsections) {
          for (let j = sections[i].subsections!.length - 1; j >= 0; j--) {
            const subElement = document.getElementById(sections[i].subsections![j].id);
            if (subElement && subElement.offsetTop <= scrollPosition) {
              setActiveSection(sections[i].subsections![j].id);
              return;
            }
          }
        }
      }
    };

    handleScroll();

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [sections, offset]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -offset;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return { activeSection, scrollToSection };
}
import { Component, ChangeDetectionStrategy, effect, viewChildren, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
  
})
export class HomeComponent {
  // Get references to all animatable elements in the template
  elementsToAnimate = viewChildren<ElementRef<HTMLElement>>('scrollAnimate');
  
  // Create a signal to hold a Set of elements that are currently visible
  visibleElements = signal(new Set<HTMLElement>());

  constructor() {
    // This effect runs once the view is initialized and the elements are available
    effect(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // When an element becomes visible, update the signal's state
            this.visibleElements.update(currentSet => currentSet.add(entry.target as HTMLElement));
            // Stop observing the element once it's visible
            observer.unobserve(entry.target);
          }
        });
      }, { 
        rootMargin: '0px 0px -100px 0px', // Trigger a bit before it's fully in view
        threshold: 0.1 
      });

      // Start observing each element found by viewChildren
      this.elementsToAnimate().forEach(el => observer.observe(el.nativeElement));

      // The effect's cleanup function automatically disconnects the observer
      // when the component is destroyed, preventing memory leaks.
      return () => observer.disconnect();
    });
  }
}
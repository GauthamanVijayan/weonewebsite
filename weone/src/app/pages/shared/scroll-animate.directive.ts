import { Directive, ElementRef, Input, effect, signal } from '@angular/core';

@Directive({
  selector: '[appScrollAnimate]',
  standalone: true
})
export class ScrollAnimateDirective {
  // Use traditional @Input for template binding compatibility
  @Input() animationDelay = 0;
  
  private isVisible = signal(false);
  private element!: HTMLElement; // Use definite assignment assertion

  constructor(private elementRef: ElementRef) {
    // Initialize element in constructor body
    this.element = this.elementRef.nativeElement as HTMLElement;

    // Effect to handle visibility changes
    effect(() => {
      if (this.isVisible()) {
        this.element.classList.add('weone-animate-visible');
      }
    });
  }

  ngOnInit() {
    // Setup observer after initialization
    this.setupObserver();
  }

  private setupObserver() {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      // SSR safety - show content immediately
      this.isVisible.set(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Add delay if specified
            if (this.animationDelay > 0) {
              setTimeout(() => {
                this.isVisible.set(true);
              }, this.animationDelay);
            } else {
              this.isVisible.set(true);
            }
            // Stop observing once visible
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
      }
    );

    observer.observe(this.element);
  }
}
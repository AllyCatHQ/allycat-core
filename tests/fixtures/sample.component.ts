import { Component } from '@angular/core';

@Component({
  selector: 'app-sample',
  template: `
    <div class="container">
      <h1>Sample Inline Component</h1>

      <!-- Intentional a11y violation: missing alt on image -->
      <img src="hero.jpg">

      <!-- [aria-label] binding — transformer must convert to aria-label="dynamic" -->
      <button [aria-label]="submitLabel" (click)="onSubmit()">Submit</button>

      <!-- Intentional a11y violation: empty button, no accessible name -->
      <button (click)="openMenu()"></button>

      <nav aria-label="Footer links">
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
      </nav>
    </div>
  `,
})
export class SampleComponent {
  submitLabel = 'Submit form';
  onSubmit() {}
  openMenu() {}
}

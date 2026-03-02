import styles from './css-modules.module.css';
import { Component } from '@angular/core';

@Component({
  selector: 'app-css-modules',
  template: `
    <main>
      <p [class]="styles.failGray">Gray on white — should fail contrast</p>
      <p [class]="styles['fail-yellow']">Yellow on white — should fail contrast</p>
      <p [class]="styles.passBlack">Black on white — should pass</p>
      <button [ngClass]="styles.failGray">Button via ngClass — should fail</button>
      <img [attr.aria-label]="dynamicLabel" [class]="styles.passBlack" src="x.png" />
    </main>
  `
})
export class CssModulesComponent {}
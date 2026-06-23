import React from 'react';

/**
 * ListRealViolation.jsx
 *
 * TEST PURPOSE: Confirm that REAL list violations are still caught.
 * These are hand-written HTML problems, not custom component artifacts.
 */
export function BrokenList() {
  return (
    <main>
      <h1>Broken Lists</h1>

      {/* Real violation: <div> is not a valid child of <ul> */}
      <ul>
        <div>This div should not be inside a ul</div>
      </ul>

      {/* Real violation: orphan <li> outside any list */}
      <li>I am an orphan list item</li>
    </main>
  );
}

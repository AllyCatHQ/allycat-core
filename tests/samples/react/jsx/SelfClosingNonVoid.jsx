import React from 'react';

/**
 * TEST PURPOSE: Zero violations.
 * Self-closing custom components inside structural parents must produce
 * proper closing tags so siblings are not absorbed as children.
 */
export default function SelfClosingNonVoid({ items, defs }) {
  return (
    <main>
      <h1>Self-Closing Component Test</h1>

      <ul>
        <ListItem label="First" />
        <ListItem label="Second" />
        <ListItem label="Third" />
      </ul>

      <dl>
        <DefRow term="A" desc="Alpha" />
        <DefRow term="B" desc="Beta" />
      </dl>

      <table>
        <tbody>
          <TableRow data="row1" />
          <TableRow data="row2" />
        </tbody>
      </table>

      <ul>
        <li>Static item</li>
      </ul>
    </main>
  );
}

import React from 'react';
import StyledItem from './StyledItem';
import DefinitionRow from './DefinitionRow';
import NavItem from './NavItem';

/**
 * ListFalsePositive.jsx
 *
 * TEST PURPOSE: Zero list violations.
 * All custom components inside lists should be handled by
 * context-aware tag substitution, not flagged as violations.
 */
export default function Dashboard({ items, definitions, navLinks }) {
  return (
    <main>
      <h1>Dashboard</h1>

      {/* .map() with custom component inside <ul> */}
      <h2>Recent Items</h2>
      <ul>
        {items.map(item => (
          <StyledItem key={item.id}>{item.name}</StyledItem>
        ))}
      </ul>

      {/* Custom component inside <dl> */}
      <h2>Definitions</h2>
      <dl>
        {definitions.map(def => (
          <DefinitionRow key={def.id} term={def.term} description={def.desc} />
        ))}
      </dl>

      {/* .map() with custom component inside <ol> */}
      <nav aria-label="Main navigation">
        <ol>
          {navLinks.map(link => (
            <NavItem key={link.href} href={link.href} label={link.label} />
          ))}
        </ol>
      </nav>

      {/* Control: plain HTML list (must stay clean) */}
      <h2>Static List</h2>
      <ul>
        <li>First item</li>
        <li>Second item</li>
        <li>Third item</li>
      </ul>
    </main>
  );
}

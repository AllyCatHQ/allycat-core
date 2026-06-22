import React from 'react';
import StyledItem from './StyledItem';

/**
 * ListMixedViolation.jsx
 *
 * TEST PURPOSE: A real list violation must still be caught when the same list
 * also contains custom components. This is the regression case for the removed
 * data-allycat-substituted suppression, which used to silently hide the <div>
 * because a sibling custom component's marker appeared in the parent's HTML.
 */
export default function MixedList({ items }) {
  return (
    <main>
      <h1>Mixed List</h1>
      <ul>
        <StyledItem>Good item</StyledItem>
        <div>Bad item — a div is not a valid child of ul</div>
        <StyledItem>Another good item</StyledItem>
      </ul>
    </main>
  );
}

import css from 'styled-jsx/css';
import { styled } from '@stitches/react';

// CSS-in-JS detection fixture — covers styled-jsx and stitches.
// Both are runtime CSS-in-JS libraries. Only ONE warning fires per scan
// (the first match), which is the expected behaviour of detectCssInJs().

// styled-jsx usage (Next.js built-in)
const cardStyle = css;

// @stitches/react usage
const StitchesBox = styled('div', {
  backgroundColor: '#555',
  color: '#666',
});

export default function CssInJsExtraLibsPage() {
  return (
    <div>
      {/* Violation 1: img without alt */}
      <img src='logo.png' />

      {/* Violation 2: input without a label */}
      <input type='text' placeholder='Search' />

      <StitchesBox>content</StitchesBox>
    </div>
  );
}

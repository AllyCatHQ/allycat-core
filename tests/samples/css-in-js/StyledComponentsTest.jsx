import styled from 'styled-components';

// Styled-components usage — CSS is generated at runtime, so contrast checking
// is unavailable. AllyCat will warn and continue scanning for other violations.

const Card = styled.div`
  background: #555;
  color: #666; /* contrast ~1.15:1 — would fail if CSS were injectable */
`;

const IconBtn = styled.button`
  background: transparent;
`;

export default function StyledPage() {
  return (
    <Card>
      {/* Violation 1: img without alt */}
      <img src='logo.png' />

      {/* Violation 2: button with no accessible name */}
      <IconBtn />

      {/* Violation 3: input without a label */}
      <input type='text' placeholder='Search' />
    </Card>
  );
}
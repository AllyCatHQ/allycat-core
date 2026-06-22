import React from 'react';
import { Select, Button, Input, Form, Label } from './design-system';

/**
 * TEST PURPOSE: Zero violations.
 * PascalCase components must NOT be treated as native HTML elements,
 * even though their lowercased names match entries in HTML_TAGS.
 */
export default function HtmlNameCollision() {
  return (
    <main>
      <h1>Component Name Collision Test</h1>

      <Select options={['a', 'b']} onChange={() => {}} />
      <Button variant="primary">Click me</Button>
      <Input placeholder="Type here" />
      <Form onSubmit={() => {}}>
        <Label>Name</Label>
      </Form>

      <label htmlFor="real-select">Country</label>
      <select id="real-select" name="country">
        <option value="us">United States</option>
      </select>

      <label htmlFor="real-input">Email</label>
      <input id="real-input" type="email" name="email" />

      <button type="button">Real Button</button>
    </main>
  );
}

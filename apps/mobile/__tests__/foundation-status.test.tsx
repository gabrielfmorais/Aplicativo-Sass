import { render } from '@testing-library/react-native';

import { FoundationStatusScreen } from '@/features/foundation-status/FoundationStatusScreen';

const textOf = (node: { props: Record<string, unknown> }): string =>
  Array.isArray(node.props['children']) ? node.props['children'].join('') : String(node.props['children']);

describe('FoundationStatusScreen (skeleton smoke, SPEC-000 AC9)', () => {
  it('renders values computed by @app/core', async () => {
    const { getByText, getByTestId } = await render(<FoundationStatusScreen />);
    expect(getByText('Foundation OK')).toBeTruthy();
    expect(textOf(getByTestId('core-version'))).toContain('0.0.0-foundation');
    expect(textOf(getByTestId('today'))).toMatch(/\d{4}-\d{2}-\d{2}$/);
    expect(textOf(getByTestId('uuid'))).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

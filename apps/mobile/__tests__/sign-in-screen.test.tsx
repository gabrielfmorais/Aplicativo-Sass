import type { AuthPort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '@/features/auth/SignInScreen';

const makeAuth = () =>
  ({
    requestOtp: jest.fn(async () => undefined),
    verifyOtp: jest.fn(async () => undefined),
    signInWithProvider: jest.fn(async () => true),
    signOut: jest.fn(async () => undefined),
    getState: jest.fn(async () => ({ status: 'unauthenticated' as const })),
    onStateChange: jest.fn(() => () => undefined),
  }) as unknown as jest.Mocked<AuthPort>;

describe('SignInScreen (SPEC-001 FR3/FR8)', () => {
  it('validates the email at the boundary and never calls the port with invalid input', async () => {
    const auth = makeAuth();
    const s = await render(<SignInScreen auth={auth} />);
    await fireEvent.changeText(s.getByLabelText('Email'), 'nope');
    await fireEvent.press(s.getByText('Continuar com email'));
    expect(auth.requestOtp).not.toHaveBeenCalled();
    expect(await s.findByText('Digite um email válido.')).toBeTruthy();
  });

  it('requests a code with the normalised email, shows the non-enumerating message and the code step', async () => {
    const auth = makeAuth();
    const s = await render(<SignInScreen auth={auth} />);
    await fireEvent.changeText(s.getByLabelText('Email'), ' Ana@Example.com ');
    await fireEvent.press(s.getByText('Continuar com email'));
    await waitFor(() => expect(auth.requestOtp).toHaveBeenCalledWith('ana@example.com'));
    expect(await s.findByText('Se este email puder receber códigos, enviamos um agora.')).toBeTruthy();
    await fireEvent.changeText(s.getByLabelText('Código'), '123456');
    await fireEvent.press(s.getByText('Confirmar código'));
    await waitFor(() => expect(auth.verifyOtp).toHaveBeenCalledWith('ana@example.com', '123456'));
  });

  it('shows a generic error and stays on the code step when the code is rejected', async () => {
    const auth = makeAuth();
    auth.verifyOtp.mockRejectedValueOnce(new Error('otp_expired'));
    const s = await render(<SignInScreen auth={auth} />);
    await fireEvent.changeText(s.getByLabelText('Email'), 'ana@example.com');
    await fireEvent.press(s.getByText('Continuar com email'));
    await s.findByLabelText('Código');
    await fireEvent.changeText(s.getByLabelText('Código'), '000000');
    await fireEvent.press(s.getByText('Confirmar código'));
    expect(await s.findByText('Código inválido ou expirado.')).toBeTruthy();
    expect(s.getByText('Confirmar código')).toBeTruthy();
  });
});

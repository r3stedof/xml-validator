import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('XML Validator interface', () => {
  it('renders editor and check action', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Проверить XML/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Редактор XML')).toBeInTheDocument();
  });
  it('checks the sample document and displays a real result', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Проверить XML/i }));
    await waitFor(() => expect(screen.getByText('XML корректен')).toBeInTheDocument());
    expect(screen.getByText(/Документ успешно разобран/)).toBeInTheDocument();
  });
  it('can clear the editor', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Очистить/i }));
    expect(screen.getByText('Редактор очищен.')).toBeInTheDocument();
  });
  it('switches themes', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Включить тёмную тему' }));
    expect(container.querySelector('.app')).toHaveClass('dark');
  });
});

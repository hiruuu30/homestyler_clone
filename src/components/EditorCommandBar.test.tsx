import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorCommandBar } from './EditorCommandBar';

function button(markup: string, label: string): string {
  return markup.match(new RegExp(`<button\\b[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? '';
}

describe('EditorCommandBar', () => {
  it('renders the measured command order as an accessible toolbar', () => {
    const markup = renderToStaticMarkup(<EditorCommandBar onSave={() => {}} />);
    expect(markup).toContain('role="toolbar"');
    const names = [...markup.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(names).toEqual(['File', 'Save project', 'Undo', 'Redo', 'Clear', 'Construction', 'Tools', 'View', 'AI Tools', 'Export', 'Images', 'Render']);
  });

  it('keeps explicit Save enabled for a clean starter and only disables absent actions', () => {
    const saved = renderToStaticMarkup(<EditorCommandBar saved onSave={() => {}} />);
    expect(button(saved, 'Save project')).not.toContain('disabled');
    expect(button(saved, 'Save project')).toContain('Project is saved');
    expect(button(renderToStaticMarkup(<EditorCommandBar />), 'Save project')).toContain('disabled');
  });

  it('reflects Undo and Redo availability', () => {
    const unavailable = renderToStaticMarkup(<EditorCommandBar />);
    expect(button(unavailable, 'Undo')).toContain('disabled');
    expect(button(unavailable, 'Redo')).toContain('disabled');
    const available = renderToStaticMarkup(<EditorCommandBar canUndo canRedo />);
    expect(button(available, 'Undo')).not.toContain('disabled');
    expect(button(available, 'Redo')).not.toContain('disabled');
  });

  it('honestly disables unimplemented AI, image and render commands', () => {
    const markup = renderToStaticMarkup(<EditorCommandBar />);
    for (const label of ['AI Tools', 'Images', 'Render']) {
      expect(button(markup, label)).toContain('disabled');
      expect(button(markup, label)).toContain(`${label} is not available yet`);
    }
  });
});

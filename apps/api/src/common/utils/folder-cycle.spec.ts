import { wouldCreateFolderCycle } from './folder-cycle';

describe('wouldCreateFolderCycle', () => {
  it('rejects moving a folder into itself', () => {
    expect(wouldCreateFolderCycle('a', 'a', [])).toBe(true);
  });

  it('rejects moving a folder into a descendant', () => {
    expect(wouldCreateFolderCycle('parent', 'child', ['child', 'parent'])).toBe(
      true,
    );
  });

  it('allows moving a folder under a sibling or ancestor', () => {
    expect(
      wouldCreateFolderCycle('moving', 'sibling', ['sibling', 'root']),
    ).toBe(false);
  });
});

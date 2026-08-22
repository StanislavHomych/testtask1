import {
  clipBreadcrumbsToRoot,
  redactParentIdOutsideClip,
} from './access-redaction';

describe('access redaction (data leakage)', () => {
  const crumbs = [
    { id: 'root', name: 'Root' },
    { id: 'legal', name: 'Legal' },
    { id: 'nda', name: 'NDAs' },
  ];

  it('clips breadcrumbs above the share root', () => {
    expect(clipBreadcrumbsToRoot(crumbs, 'legal')).toEqual([
      { id: 'legal', name: 'Legal' },
      { id: 'nda', name: 'NDAs' },
    ]);
  });

  it('returns full breadcrumbs when there is no clip root', () => {
    expect(clipBreadcrumbsToRoot(crumbs, null)).toEqual(crumbs);
  });

  it('nulls parentId at the share root', () => {
    expect(redactParentIdOutsideClip('legal', 'root', 'legal')).toBeNull();
  });

  it('keeps parentId under the share root', () => {
    expect(redactParentIdOutsideClip('nda', 'legal', 'legal')).toBe('legal');
  });
});

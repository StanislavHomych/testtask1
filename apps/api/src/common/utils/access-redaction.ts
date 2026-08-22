/**
 * Clip breadcrumbs so shared viewers never see ancestor names/IDs above the
 * shared root (data-leakage prevention).
 */
export function clipBreadcrumbsToRoot<T extends { id: string }>(
  breadcrumbs: T[],
  clipRootId: string | null | undefined,
): T[] {
  if (!clipRootId) {
    return breadcrumbs;
  }
  const index = breadcrumbs.findIndex((crumb) => crumb.id === clipRootId);
  return index >= 0 ? breadcrumbs.slice(index) : breadcrumbs;
}

/**
 * Hide parentId when the parent sits outside the shared clip root.
 */
export function redactParentIdOutsideClip(
  folderId: string,
  parentId: string | null,
  clipRootId: string | null | undefined,
): string | null {
  if (!clipRootId) {
    return parentId;
  }
  if (folderId === clipRootId) {
    return null;
  }
  return parentId;
}

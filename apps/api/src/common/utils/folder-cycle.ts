export function wouldCreateFolderCycle(
  movingFolderId: string,
  targetParentId: string,
  targetParentAncestorIds: string[],
): boolean {
  return (
    movingFolderId === targetParentId ||
    targetParentAncestorIds.includes(movingFolderId)
  );
}

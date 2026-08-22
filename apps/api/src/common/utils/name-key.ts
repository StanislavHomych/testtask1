export function toNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function buildConflictName(baseName: string, attempt: number): string {
  if (attempt <= 1) {
    return baseName;
  }

  const extensionMatch = baseName.match(/^(.*?)(\.[^.]+)?$/);
  const stem = extensionMatch?.[1] ?? baseName;
  const extension = extensionMatch?.[2] ?? '';
  return `${stem} (${attempt - 1})${extension}`;
}

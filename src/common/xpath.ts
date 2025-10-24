export function escapeForXPath(value: string): string {
  return value.replace(/'/g, `', "'", '`);
}

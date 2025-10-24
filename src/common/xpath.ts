// src/common/xpath.ts

// export function escapeForXPath(value: string): string {
//   return value.replace(/'/g, `', "'", '`);
// }
export function escapeForXPath(value: string): string {
  return value.replace(/['"]/g, `', $&, '`); // Escape both quotes
}
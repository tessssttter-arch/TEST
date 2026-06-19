/**
 * Утилита нормализации тегов для предотвращения дублирования.
 * Применяет единое форматирование к тегам: чистит whitespace, удаляет решетки, приводит к нижнему регистру.
 */

export const normalizeTag = (tag: string): string => {
  if (!tag) return '';
  return tag
    .trim()
    .replace(/#/g, '')
    .toLowerCase();
};

/**
 * Нормализовать массив тегов (убирает пустые и дубликаты)
 */
export const normalizeTagsArray = (tags: string[] | undefined | null): string[] => {
  if (!tags || !Array.isArray(tags)) return [];
  const normalized = tags.map(normalizeTag).filter(t => t.length > 0);
  return Array.from(new Set(normalized));
};

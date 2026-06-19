# Sync Hub: PARS

Детальный план задач для модуля PARS (Импорт и парсинг постов VK).

## Активные задачи
- [ ] Настройка клиента авторизации и взаимодействия с VK API
- [ ] Валидация структуры постов и цен
- [x] **[AI-EDIT] Настройка экспорта в формате KATALOG Product | 2026-06-14**
- [x] **[AI-EDIT] Создание модуля экспорта `src/lib/catalog-exporter.ts` | 2026-06-14**
- [x] **[AI-EDIT] Интеграция кнопки экспорта в UI | 2026-06-14**
- [x] **[AI-EDIT] Рефакторинг и исправление уязвимостей | 2026-06-14**
- [ ] **[AI-EDIT] Улучшение UX онлайн-парсинга | 2026-06-14**

- [x] **[AI-EDIT] Обратный импорт правок из Excel (CSV) | 2026-06-16**
  - [x] Расширить `PostsStoreContextType` методом `bulkUpdatePostDetails(updates: Record<string, { text: string; price: number | null }>)`.
  - [x] Реализовать `bulkUpdatePostDetails` в `src/hooks/use-posts-store.tsx`: массовое обновление `editsMap` и `posts`.
  - [x] Экспортировать `bulkUpdatePostDetails` через `PostsStoreProvider`.
  - [x] Создать `src/lib/csv-importer.ts` с потоковым парсером CSV (RFC 4180): `parseCsv`, `validateCsvHeaders`, `sanitizePostId`, `sanitizeText`, `sanitizePrice`.
  - [x] Добавить в `src/components/app/file-uploader.tsx` режим `mode="csv"` с пропсом `FileUploaderMode`.
  - [x] Валидировать заголовки CSV строго по списку: `ID Поста`, `Отредактированный текст`, `Итоговая цена (₽)`.
  - [x] Парсить строки в `Record<string, { text: string; price: number | null }>` и вызывать `bulkUpdatePostDetails(updates)`.
  - [x] Добавить в `src/components/app/vk-analyzer.tsx` отдельный диалог импорта правок, чтобы не смешивать с первичной загрузкой JSON.
  - [x] Обработать пустые ячейки: не перезаписывать поле, если значение пустое.
  - [x] Отображать результат импорта: кол-во успешно применённых правок и пропущенных строк.

- [ ] **[AI-EDIT] Интеграционный чекпоинт | 2026-06-16**
  - Сверить схему `CatalogProduct` в `DOC/PARS/contracts/` после добавления обратного импорта.

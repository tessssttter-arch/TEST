/**
 * Утилиты для автоматической замены текста в описаниях товаров с поддержкой регулярных выражений (Regex) и пресетов.
 */

export interface ReplacementMatch {
  productId: string;
  originalText: string;
  replacedText: string;
  matchCount: number;
}

export interface TextPreset {
  id: string;
  name: string;
  description: string;
  search: string;
  replace: string;
  isRegex: boolean;
  matchCase: boolean;
}

export const PRESETS: TextPreset[] = [
  {
    id: "remove_vk",
    name: "Удаление ссылок VK",
    description: "Находит любые ссылки на vk.com (группы, посты, домены)",
    search: "(https?:\\/\\/)?(www\\.)?(vk\\.com|vkontakte\\.ru)\\/[a-zA-Z0-9_\\-\\.\\/]+",
    replace: "",
    isRegex: true,
    matchCase: false
  },
  {
    id: "remove_tg",
    name: "Удаление Telegram",
    description: "Находит каналы по юзернеймам (@name) и прямым ссылкам t.me",
    search: "((https?:\\/\\/)?(www\\.)?t\\.me\\/[a-zA-Z0-9_\\-\\.\\/]+|@[a-zA-Z0-9_]{4,})",
    replace: "",
    isRegex: true,
    matchCase: false
  },
  {
    id: "clean_html",
    name: "Чистка HTML",
    description: "Удаляет любые HTML-теги",
    search: "<[^>]*>",
    replace: "",
    isRegex: true,
    matchCase: false
  },
  {
    id: "mask_phones",
    name: "Маскировка телефонов",
    description: "Скрывает мобильные и городские телефонные номера",
    search: "(\\+7|8|7)?[\\s\\-]?\\(?\\d{3}\\)?[\\s\\-]?\\d{3}[\\s\\-]?\\d{2}[\\s\\-]?\\d{2}",
    replace: "[ТЕЛЕФОН СКРЫТ]",
    isRegex: true,
    matchCase: false
  }
];

export function analyzeReplacements(
  text: string,
  search: string,
  replace: string,
  isRegex: boolean,
  matchCase: boolean
): { replacedText: string; matchCount: number } {
  if (!search) {
    return { replacedText: text, matchCount: 0 };
  }

  try {
    let regex: RegExp;
    if (isRegex) {
      const flags = matchCase ? "g" : "gi";
      regex = new RegExp(search, flags);
    } else {
      // Экранируем символы для обычного текстового поиска, чтобы Regex не падал
      const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const flags = matchCase ? "g" : "gi";
      regex = new RegExp(escaped, flags);
    }

    const matches = text.match(regex);
    const matchCount = matches ? matches.length : 0;
    const replacedText = text.replace(regex, replace);

    return { replacedText, matchCount };
  } catch (e) {
    // В случае неверного регулярного выражения возвращаем оригинальный текст
    return { replacedText: text, matchCount: 0 };
  }
}

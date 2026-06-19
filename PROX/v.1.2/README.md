# Webshare Proxy Dashboard v1.1.2 PRO — Документация разработчика

## 🏗 Архитектура проекта

Full-stack приложение: React SPA + Express backend proxy.

### Стек технологий
- **Frontend**: React 19, Vite 6, Tailwind CSS v4.
- **Backend**: Node.js + Express (ESBuild → `dist/server.cjs`).
- **State**: React hooks + `localStorage` (аккаунты, история, фильтры).
- **Иконки**: `lucide-react`.

### Структура проекта
```
PROX/v.1.2/
├── server.ts               # Точка входа Express. Проксирование к Webshare API v1/v2.
├── src/
│   ├── main.tsx            # Монтирование React-приложения
│   ├── index.css           # Tailwind + кастомный скроллбар
│   └── App.tsx             # Основной компонент: multi-token UI, ротация, экспорт
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── metadata.json
└── .env.example
```

### Безопасность / CORS
Бэкенд выступает как proxy: принимает запросы от фронта, добавляет `Authorization: Token <...>` и идёт к `proxy.webshare.io`. Токены не покидают локальный сервер.

---

## 📡 Внешние интеграции: Webshare API

### v1 API (список прокси)
- `GET /api/proxy/list/` — список прокси (`ports.http`, `valid`, `country_code`, `username`, `password`).
- `GET /api/profile/` — профиль аккаунта (`plan.bandwidth_limit`, `plan.bandwidth_used`).
- `GET /api/subscription/` — детали подписки (тариф, цена, дата списания, автопролонгация).

### v2 API (действия над аккаунтом)
- `GET /api/v2/proxy/config/` — текущая конфигурация прокси.
- `PATCH /api/v2/proxy/config/` — обновление username/password.
- `POST /api/v2/proxy/replacement/` — On-Demand Replacement IP.

---

## 🔌 Внутренние эндпоинты (наш Express-сервер)

| Метод | Путь | Body params | Назначение |
|-------|------|-------------|-----------|
| `GET` | `/api/proxy/list` | — | Прокси v1 (legacy, для одиночного токена по заголовку Authorization). |
| `POST` | `/api/proxy/fetch-bulk` | `{ accounts: [{ alias: string, token: string }] }` | Параллельная агрегация списка + профиля по пулу токенов. |
| `PATCH` | `/api/proxy/update-credentials` | `{ token: string, username: string, password: string }` | Смена креденшалов для конкретного токена. |
| `POST` | `/api/proxy/replace-ips` | `{ token: string, ips?: string[], replacement_all?: boolean }` | Запрос замены IP (ротация пула). |

### Формат ответа `POST /api/proxy/fetch-bulk`
```json
{
  "summary": {
    "total_proxies": 120,
    "total_valid": 115,
    "total_invalid": 5,
    "total_bandwidth_used": 487000000000,
    "total_bandwidth_limit": 500000000000
  },
  "groups": [
    {
      "token_alias": "Куратор Маша",
      "token": "m8w80z...",
      "status": "success",
      "stats": { "total": 10, "valid": 10, "invalid": 0 },
      "profile": {
        "bandwidth_limit": 500000000000,
        "bandwidth_used": 200000000000,
        "plan_name": "Pro",
        "plan_price": 29.0,
        "plan_currency": "USD",
        "auto_prolong": true,
        "next_billing_date": "2026-07-15"
      },
      "proxies": [ /* массив ответа Webshare v1 */ ]
    }
  ]
}
```

> **[AI-EDIT] Добавлен контракт ответа `GroupResult` с профилем тарифа и датой списания | 2026-06-17**

---

## 📊 Интерфейс и данные

### Глобальная статистика (сайдбар)
- **IP всего / Живых (OK) / Ошибки (ERR)** — суммарные значения.
- **Успешность** — % валидных прокси.
- **ОБЩИЙ ТРАФИК** — `bandwidth_used / bandwidth_limit` с прогресс-баром.
- **Остаток трафика** — `limit - used` в GB.
- **Следующее списание** — дата из `/api/subscription/`.

### Карточка токена (группы в сайдбаре)
- Статус: активен (зелёный dot) / ошибка (красный).
- Метрики: `valid / total VALID`, `bandwidth_used`, `остаток дней до исчерпания`.
- Действия: кнопка ротации → панель смены креденшалов и замены IP.

### Таблица прокси
- **Endpoint Address** — `proxy_address:http_port`.
- **Группа / Токен** — алиас куратора.
- **Протокол** — `HTTP/SOCKS5`.
- **Страна** — `country_code`.
- **Статус** — OK / FAIL.
- **Действие** — копирование `IP:PORT:USER:PASS`.

### Буфер экспорта (правая панель)
- Live-подготовленный текст в формате `IP:PORT:USER:PASS`.
- Кнопки: «Скопировать всё» и «Скачать .txt».

---

## 🚀 Запуск

```bash
npm install
npm run dev           # порт 3000, Vite middleware + Express
npm run build         # фронт в dist/ + бекенд в dist/server.cjs
npm start             # production
```

---

## 🛠 Реализованный функционал

### Мультитокенность
- Пул аккаунтов в `localStorage` (ключ `webshare_accounts`).
- Одиночный и массовый импорт (`Алиас:Токен` построчно).
- Автозагрузка при старте приложения.

### Параллельная агрегация
- Один `POST /api/proxy/fetch-bulk` для всех токенов:
  - Опрос `GET /api/proxy/list/?page_size=250`
  - Опрос `GET /api/profile/`
  - Суммация `total`, `valid`, `invalid`, трафика.
- **Устойчивость (applied)**: бекенд использует `Promise.allSettled`. Падение одного токена (401/403/таймаут) не ломает сбор по остальным. Ошибочный токен помечается `status: 'error'` и отображается в интерфейсе как неактивный.

### Ротация и безопасность
- Смена username/password через `PATCH /api/v2/proxy/config/` → мгновенное обновление всех прокси токена.
- Полная замена IP пула через `POST /api/v2/proxy/replacement/`.
- В интерфейсе — ротационная панель с полями для нового логина/пароля и кнопкой запроса смены IP.

### Экспорт
- Формирование списка `IP:PORT:USER:PASS`.
- Копирование всего списка / одной строки.
- Скачивание `.txt`.

---

## 📈 Roadmap (оставшиеся улучшения)

| Приоритет | Задача | Статус |
|-----------|--------|--------|
| P1 | **Дней до исчерпания** — хранить историю `bandwidth_used` и считать тренд по последним замерам | 🔲 В работе |
| P2 | **Тарифный план и дата продления** — подтягивать `/api/subscription/` (price, currency, renew date) | 🔲 В работе |
| P3 | **Кэширование** — TTL 300с на `localStorage`, чтобы не долбить API при частых обновлениях | 🔲 В работе |
| P4 | **Пагинация** — проходить `data.next` на бекенде для больших пулов (>250) | 🔲 В работе |
| P5 | **Спед-тест прокси** — фоновый запрос через каждый прокси с бекенда для реального health-check | 🔲 Планируется |
| P6 | **Разбивка по странам** — мини-график в карточке токена (топ-5 стран) | 🔲 Планируется |
| P7 | **Country filter** — фильтрация таблицы по коду страны в реальном времени | 🔲 В работе |

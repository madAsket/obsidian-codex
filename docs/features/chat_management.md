# Chat management (multi-chat)

## Решения
- Хранить список чатов и настройки в `data.json`.
- Историю сообщений каждого чата хранить в отдельных JSON-файлах.
- Переключение чатов блокируется, пока идет стрим ответа.
- Контекст (`Vault` / `Current note`) хранится на уровне чата.
- Счетчик токенов отображается и сохраняется для текущего чата.
- Rename/Delete пока не делаем.

## Хранилище
`data.json` (минимальный вес, только метаданные):
```json
{
  "activeChatId": "chat_...",
  "chats": [
    {
      "id": "chat_...",
      "title": "New chat",
      "threadId": "thread_...",
      "contextScope": "vault",
      "usage": { "inputTokens": 0, "cachedInputTokens": 0, "outputTokens": 0 },
      "createdAt": 0,
      "updatedAt": 0
    }
  ],
  "settings": { "model": "gpt-5.2", "reasoning": "low" }
}
```

Файлы чатов:
- Папка: `.obsidian/plugins/obsidian-codex/chats/`
- Формат: `<chatId>.json`
```json
{
  "messages": [ /* Message[] */ ],
  "updatedAt": 0
}
```

## Поведение
- **New chat**: создаем запись в `data.json`, создаем файл истории, делаем активным.
- **Switch chat**: если стрим активен — блокируем. Иначе сохраняем текущий чат, подгружаем сообщения выбранного, `CodexService` резюмирует `threadId` выбранного.
- **Usage**: считаем и сохраняем usage в метаданных чата.
- **Context**: переключатель контекста влияет только на активный чат.

## Задачи
1. Обновить схему `PluginData` + `DataStore` (chat list, activeChatId, usage, contextScope).
2. Реализовать хранилище истории чатов в файлах (ensure папки, read/write, migrate).
3. Добавить API в `DataStore`: createChat, switchChat, updateChatUsage, updateChatMeta.
4. Обновить `ChatApp`: работать с активным чатом, блокировать переключение при стриме.
5. UI: селектор чатов + кнопка “New chat” в header.
6. Ручная проверка: создание/переключение, корректный `threadId`, счетчик токенов по чату.

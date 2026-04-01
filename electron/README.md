# Electron Integration

Интеграция Electron для запуска веб-версии приложения как десктопного приложения.

## Установка зависимостей

```bash
npm install
```

## Режимы работы

### 1. Режим разработки (electron-test)

Подключается к запущенному Expo dev server. Полезно для разработки с hot reload.

```bash
# Терминал 1: Запустить Expo dev server
npm run web

# Терминал 2: Запустить Electron в тестовом режиме
npm run electron:test
```

Electron автоматически подключится к `http://localhost:8081` (или URL из `EXPO_DEV_SERVER_URL`).

### 2. Режим разработки с локальным билдом (electron:dev)

Использует локальный билд из папки `dist`:

```bash
# Сначала создать билд
npm run build:web

# Затем запустить Electron
npm run electron:dev
```

### 3. Production режим (electron)

Запускает production билд из `dist`:

```bash
# Создать production билд
npm run build:web

# Запустить Electron
npm run electron
```

### 4. Сборка готового приложения

#### Сборка для текущей платформы:
```bash
npm run electron:build
```

#### Сборка для конкретной платформы:
```bash
# Windows
npm run electron:build:win

# macOS
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

#### Сборка без установщика (только папка):
```bash
npm run electron:pack
```

Результаты сборки будут в папке `electron-dist/`.

## Использование Electron моста

### Импорт

```typescript
import { isElectron, getElectronVersion, showMessageBox, readFile, writeFile } from '@/electron/bridge';
```

### Примеры использования

#### Проверка, запущено ли в Electron:
```typescript
import { isElectron } from '@/electron/bridge';

if (isElectron()) {
  console.log('Running in Electron');
}
```

#### Получение версии:
```typescript
import { getElectronVersion } from '@/electron/bridge';

const version = await getElectronVersion();
console.log('Electron version:', version);
```

#### Показать диалог сообщения:
```typescript
import { showMessageBox } from '@/electron/bridge';

const result = await showMessageBox({
  type: 'info',
  title: 'Уведомление',
  message: 'Операция завершена успешно!',
  buttons: ['OK', 'Отмена'],
});

if (result && result.response === 0) {
  console.log('Пользователь нажал OK');
}
```

#### Открыть диалог выбора файла:
```typescript
import { showOpenDialog } from '@/electron/bridge';

const result = await showOpenDialog({
  title: 'Выберите файл',
  filters: [
    { name: 'Images', extensions: ['jpg', 'png', 'gif'] },
    { name: 'All Files', extensions: ['*'] },
  ],
  properties: ['openFile', 'multiSelections'],
});

if (result && !result.canceled) {
  console.log('Выбранные файлы:', result.filePaths);
}
```

#### Работа с файлами:
```typescript
import { readFile, writeFile, getPath } from '@/electron/bridge';

// Получить путь к папке документов
const documentsPath = await getPath('documents');

// Прочитать файл
const content = await readFile('/path/to/file.txt');

// Записать файл
const success = await writeFile('/path/to/file.txt', 'Hello, World!');
```

#### Управление окном:
```typescript
import { windowControls } from '@/electron/bridge';

// Свернуть окно
await windowControls.minimize();

// Развернуть/восстановить окно
await windowControls.maximize();

// Закрыть окно
await windowControls.close();
```

## Структура файлов

- `electron/main.js` - Главный процесс Electron
- `electron/preload.js` - Preload скрипт для безопасного взаимодействия
- `electron/bridge.ts` - TypeScript обёртки для использования в React Native Web
- `electron/types.d.ts` - TypeScript типы для Electron API
- `electron-builder.json` - Конфигурация для сборки приложения

## Переменные окружения

- `NODE_ENV` - Режим работы (`development` или `production`)
- `ELECTRON_TEST` - Включить тестовый режим (подключение к dev server)
- `EXPO_DEV_SERVER_URL` - URL Expo dev server (по умолчанию `http://localhost:8081`)

## Мосты взаимодействия

Все мосты доступны через `window.electron` в браузерном контексте. Используйте функции из `electron/bridge.ts` для типобезопасного доступа.

### Доступные функции:

- **Информация**: `getVersion()`, `getPlatform()`
- **Диалоги**: `showMessageBox()`, `showOpenDialog()`, `showSaveDialog()`
- **Файловая система**: `readFile()`, `writeFile()`, `readDir()`, `getPath()`
- **Система**: `openExternal()`, `minimize()`, `maximize()`, `close()`
- **События**: `on()`, `off()`

## Сборка для разных платформ

### Windows
- NSIS установщик (`.exe`)
- Portable версия (`.exe`)

### macOS
- DMG образ
- ZIP архив

### Linux
- AppImage
- DEB пакет

Все собранные файлы находятся в папке `electron-dist/`.

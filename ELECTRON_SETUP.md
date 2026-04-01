# Electron Setup - Краткая инструкция

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Режимы работы

#### Режим разработки с hot reload (electron-test)
```bash
# Терминал 1: Запустить Expo dev server
npm run web

# Терминал 2: Запустить Electron (подключится к dev server)
npm run electron:test
```

#### Режим разработки с локальным билдом
```bash
# Создать билд
npm run build:web

# Запустить Electron
npm run electron:dev
```

#### Production режим
```bash
# Создать production билд
npm run build:web

# Запустить Electron
npm run electron
```

### 3. Сборка готового приложения

```bash
# Сборка для текущей платформы
npm run electron:build

# Сборка для конкретной платформы
npm run electron:build:win   # Windows
npm run electron:build:mac    # macOS
npm run electron:build:linux # Linux

# Сборка без установщика (только папка)
npm run electron:pack
```

Результаты сборки будут в папке `electron-dist/`.

## Использование Electron моста

Импортируйте функции из `@/electron/bridge`:

```typescript
import { isElectron, showMessageBox, readFile, writeFile } from '@/electron/bridge';

// Проверка
if (isElectron()) {
  // Код для Electron
}

// Диалоги
const result = await showMessageBox({
  type: 'info',
  message: 'Привет из Electron!',
});

// Файлы
const content = await readFile('/path/to/file.txt');
await writeFile('/path/to/file.txt', 'Hello!');
```

Подробнее см. `electron/README.md` и `electron/example-usage.tsx`.

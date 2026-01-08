/**
 * Пример использования Electron моста в React компоненте
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import {
  isElectron,
  getElectronVersion,
  getElectronPlatform,
  showMessageBox,
  showOpenDialog,
  showSaveDialog,
  readFile,
  writeFile,
  getPath,
  openExternal,
  windowControls,
} from '@/electron/bridge';

export function ElectronExample() {
  const [electronInfo, setElectronInfo] = useState<{
    version: string | null;
    platform: string | null;
  }>({ version: null, platform: null });

  useEffect(() => {
    if (isElectron()) {
      Promise.all([
        getElectronVersion(),
        getElectronPlatform(),
      ]).then(([version, platform]) => {
        setElectronInfo({ version, platform });
      });
    }
  }, []);

  const handleShowMessage = async () => {
    const result = await showMessageBox({
      type: 'info',
      title: 'Пример',
      message: 'Это пример диалога сообщения в Electron!',
      buttons: ['OK', 'Отмена'],
    });
    console.log('Message box result:', result);
  };

  const handleOpenFile = async () => {
    const result = await showOpenDialog({
      title: 'Выберите файл',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result && !result.canceled && result.filePaths.length > 0) {
      const content = await readFile(result.filePaths[0]);
      console.log('File content:', content);
    }
  };

  const handleSaveFile = async () => {
    const documentsPath = await getPath('documents');
    const result = await showSaveDialog({
      title: 'Сохранить файл',
      defaultPath: documentsPath ? `${documentsPath}/example.txt` : undefined,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result && !result.canceled && result.filePath) {
      const success = await writeFile(result.filePath, 'Hello from Electron!');
      if (success) {
        await showMessageBox({
          type: 'info',
          message: 'Файл успешно сохранён!',
        });
      }
    }
  };

  const handleOpenExternal = async () => {
    await openExternal('https://example.com');
  };

  if (!isElectron()) {
    return (
      <View>
        <Text>Этот компонент работает только в Electron</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
        Electron Bridge Example
      </Text>

      {electronInfo.version && (
        <Text>Version: {electronInfo.version}</Text>
      )}
      {electronInfo.platform && (
        <Text>Platform: {electronInfo.platform}</Text>
      )}

      <View style={{ marginTop: 20, gap: 10 }}>
        <Button title="Show Message Box" onPress={handleShowMessage} />
        <Button title="Open File" onPress={handleOpenFile} />
        <Button title="Save File" onPress={handleSaveFile} />
        <Button title="Open External Link" onPress={handleOpenExternal} />
        <Button
          title="Minimize Window"
          onPress={() => windowControls.minimize()}
        />
        <Button
          title="Maximize Window"
          onPress={() => windowControls.maximize()}
        />
        <Button
          title="Close Window"
          onPress={() => windowControls.close()}
        />
      </View>
    </View>
  );
}

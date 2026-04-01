
import { autoImportSyncOnce } from "@/lib/autoImport";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

export const AUTO_IMPORT_TASK = "auto-import-background-task";


TaskManager.defineTask(AUTO_IMPORT_TASK, async () => {
  try {
    const { discovered, sent } = await autoImportSyncOnce();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
export async function registerAutoImportTask(minimumInterval = 15) {
  await BackgroundTask.registerTaskAsync(AUTO_IMPORT_TASK, {
    minimumInterval,
  });
}
export async function unregisterAutoImportTask() {
  await BackgroundTask.unregisterTaskAsync(AUTO_IMPORT_TASK);
}

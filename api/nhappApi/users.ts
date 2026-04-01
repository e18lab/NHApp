import { httpClient } from "./httpClient";

export async function syncUser(id: number, username: string): Promise<void> {
  await httpClient.post("/api/users/sync", { id, username });
}

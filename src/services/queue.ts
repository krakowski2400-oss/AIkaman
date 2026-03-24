import PQueue from 'p-queue';
import { EventEmitter } from 'events';

// Pula dla generowania obrazów (limit 1 na raz, aby nie zapchać modelu i darmowego API)
export const imageQueue = new PQueue({ concurrency: 1 });
export const taskEmitter = new EventEmitter();

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface Task {
  id: string;
  status: TaskStatus;
  progress: string; // np. "Generowanie tła...", "Oczekiwanie w kolejce..."
  resultUrls?: string[]; // Tablica url do podglądu 4 wariantów
  zipUrl?: string; // Link do archiwum ZIP ze wszystkimi wariantami
  error?: string;
}

// Lokalna pamięć zadań - ułatwia zarządzanie SSE i stanem. W powiększonej apce używamy np. Redisa.
export const tasks = new Map<string, Task>();

export const updateTask = (id: string, updateData: Partial<Task>) => {
  const task = tasks.get(id);
  if (task) {
    const updated = { ...task, ...updateData };
    tasks.set(id, updated);
    // Powiadamia wszystkich nasłuchujących w SSE
    taskEmitter.emit(`task-${id}`, updated);
  }
};

export const getTask = (id: string) => tasks.get(id);
export const initTask = (id: string) => {
  const task: Task = { id, status: 'queued', progress: 'Zadanie dodane do kolejki...' };
  tasks.set(id, task);
  return task;
};
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTask = exports.getTask = exports.updateTask = exports.tasks = exports.taskEmitter = exports.imageQueue = void 0;
const p_queue_1 = __importDefault(require("p-queue"));
const events_1 = require("events");
// Pula dla generowania obrazów (limit 1 na raz, aby nie zapchać modelu i darmowego API)
exports.imageQueue = new p_queue_1.default({ concurrency: 1 });
exports.taskEmitter = new events_1.EventEmitter();
// Lokalna pamięć zadań - ułatwia zarządzanie SSE i stanem. W powiększonej apce używamy np. Redisa.
exports.tasks = new Map();
const updateTask = (id, updateData) => {
    const task = exports.tasks.get(id);
    if (task) {
        const updated = { ...task, ...updateData };
        exports.tasks.set(id, updated);
        // Powiadamia wszystkich nasłuchujących w SSE
        exports.taskEmitter.emit(`task-${id}`, updated);
    }
};
exports.updateTask = updateTask;
const getTask = (id) => exports.tasks.get(id);
exports.getTask = getTask;
const initTask = (id) => {
    const task = { id, status: 'queued', progress: 'Zadanie dodane do kolejki...' };
    exports.tasks.set(id, task);
    return task;
};
exports.initTask = initTask;

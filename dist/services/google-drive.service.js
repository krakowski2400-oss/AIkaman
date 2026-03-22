"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = void 0;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const stream_1 = __importDefault(require("stream"));
const util_1 = require("util");
const finished = (0, util_1.promisify)(stream_1.default.finished);
class GoogleDriveService {
    constructor(apiKey) {
        this.drive = googleapis_1.google.drive({ version: 'v3', auth: apiKey });
    }
    /**
     * Wyciąga ID folderu z linku udostępniania
     */
    extractFolderId(link) {
        const patterns = [/folders\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/];
        for (const pattern of patterns) {
            const match = link.match(pattern);
            if (match)
                return match[1];
        }
        // Jeśli link to samo ID
        if (/^[a-zA-Z0-9_-]+$/.test(link.trim()))
            return link.trim();
        return null;
    }
    /**
     * Listuje podfoldery wewnątrz folderu (produkty)
     */
    async listSubfolders(folderId) {
        try {
            const res = await this.drive.files.list({
                q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
                orderBy: 'name',
            });
            return res.data.files || [];
        }
        catch (error) {
            console.error('❌ Błąd listowania folderów Google Drive:', error);
            return [];
        }
    }
    /**
     * Listuje zdjęcia wewnątrz konkretnego folderu produktu
     */
    async listImagesInFolder(folderId) {
        try {
            const res = await this.drive.files.list({
                q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
                fields: 'files(id, name, mimeType)',
            });
            return res.data.files || [];
        }
        catch (error) {
            console.error('❌ Błąd listowania zdjęć:', error);
            return [];
        }
    }
    /**
     * Pobiera plik graficzny na dysk lokalny
     */
    async downloadFile(fileId, destPath) {
        try {
            const res = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
            const writer = fs_1.default.createWriteStream(destPath);
            res.data.pipe(writer);
            await finished(writer);
            return true;
        }
        catch (error) {
            console.error(`❌ Błąd pobierania pliku ${fileId}:`, error);
            return false;
        }
    }
}
exports.GoogleDriveService = GoogleDriveService;

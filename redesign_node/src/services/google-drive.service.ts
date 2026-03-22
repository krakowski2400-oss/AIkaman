import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import stream from 'stream';
import { promisify } from 'util';

const finished = promisify(stream.finished);

export class GoogleDriveService {
  private drive;

  constructor(apiKey: string) {
    this.drive = google.drive({ version: 'v3', auth: apiKey });
  }

  /**
   * Wyciąga ID folderu z linku udostępniania
   */
  extractFolderId(link: string): string | null {
    const patterns = [/folders\/([a-zA-Z0-9_-]+)/, /id=([a-zA-Z0-9_-]+)/];
    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) return match[1];
    }
    // Jeśli link to samo ID
    if (/^[a-zA-Z0-9_-]+$/.test(link.trim())) return link.trim();
    return null;
  }

  /**
   * Listuje podfoldery wewnątrz folderu (produkty)
   */
  async listSubfolders(folderId: string) {
    try {
      const res = await this.drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'name',
      });
      return res.data.files || [];
    } catch (error) {
      console.error('❌ Błąd listowania folderów Google Drive:', error);
      return [];
    }
  }

  /**
   * Listuje zdjęcia wewnątrz konkretnego folderu produktu
   */
  async listImagesInFolder(folderId: string) {
    try {
      const res = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`,
        fields: 'files(id, name, mimeType)',
      });
      return res.data.files || [];
    } catch (error) {
      console.error('❌ Błąd listowania zdjęć:', error);
      return [];
    }
  }

  /**
   * Pobiera plik graficzny na dysk lokalny
   */
  async downloadFile(fileId: string, destPath: string): Promise<boolean> {
    try {
      const res = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      
      const writer = fs.createWriteStream(destPath);
      res.data.pipe(writer);
      await finished(writer);
      return true;
    } catch (error) {
      console.error(`❌ Błąd pobierania pliku ${fileId}:`, error);
      return false;
    }
  }
}

export declare class GoogleDriveService {
    private drive;
    constructor(apiKey: string);
    /**
     * Wyciąga ID folderu z linku udostępniania
     */
    extractFolderId(link: string): string | null;
    /**
     * Listuje podfoldery wewnątrz folderu (produkty)
     */
    listSubfolders(folderId: string): Promise<import("googleapis").drive_v3.Schema$File[]>;
    /**
     * Listuje zdjęcia wewnątrz konkretnego folderu produktu
     */
    listImagesInFolder(folderId: string): Promise<import("googleapis").drive_v3.Schema$File[]>;
    /**
     * Pobiera plik graficzny na dysk lokalny
     */
    downloadFile(fileId: string, destPath: string): Promise<boolean>;
}
//# sourceMappingURL=google-drive.service.d.ts.map
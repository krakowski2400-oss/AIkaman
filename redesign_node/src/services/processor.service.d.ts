import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';
import { GeminiService } from './gemini.service';
export declare class ProcessorService {
    private driveService;
    private geminiService;
    private baseTempDir;
    constructor(driveService: GoogleDriveService, geminiService: GeminiService);
    private sendSSE;
    processDrive(folderLink: string, res: Response): Promise<void>;
    processCustom(prompt: string, files: Express.Multer.File[], res: Response): Promise<void>;
    private finalizeAndSendZip;
    getZipPath(filename: string): Promise<string | null>;
}
//# sourceMappingURL=processor.service.d.ts.map
export declare class GeminiService {
    private genAI;
    private readonly TEXT_MODEL;
    private readonly IMAGE_MODEL;
    constructor(apiKey: string);
    /**
     * Pomocnicza funkcja do konwersji pliku na format Gemini
     */
    private fileToGenerativePart;
    /**
     * KROK 1: Analiza obrazu i generowanie 4 promptów (zastępuje logic_analyze_product)
     */
    generatePrompts(productName: string, imagePaths: string[]): Promise<string[]>;
    /**
     * KROK 2: Generowanie obrazu na podstawie promptu (zastępuje logic_generate_image)
     */
    generateImage(prompt: string, referenceImagePaths: string[], outputPath: string): Promise<boolean>;
}
//# sourceMappingURL=gemini.service.d.ts.map
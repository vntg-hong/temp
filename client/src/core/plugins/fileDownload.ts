import { registerPlugin } from '@capacitor/core';

export interface FileDownloadPlugin {
  writeToDownloads(options: {
    filename: string;
    data: string;
    subfolder?: string;
  }): Promise<{ uri: string; path?: string }>;
}

const FileDownload = registerPlugin<FileDownloadPlugin>('FileDownload');

export { FileDownload };

import { api } from '.';
import type { FileAttachment, FileDownloadResponse } from '../types/files';

export const filesApi = {
  /**
   * Upload a file to a chat. Returns the created FileAttachment record.
   */
  uploadFile: async (chatId: number, file: File): Promise<FileAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<FileAttachment>(
      `/chats/${chatId}/files`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  /**
   * Get all file attachments for a chat.
   */
  getChatFiles: async (chatId: number): Promise<FileAttachment[]> => {
    const response = await api.get<FileAttachment[]>(`/chats/${chatId}/files`);
    return response.data;
  },

  /**
   * Get a pre-signed download URL for a file.
   */
  getFileUrl: async (fileId: number): Promise<FileDownloadResponse> => {
    const response = await api.get<FileDownloadResponse>(`/files/${fileId}/url`);
    return response.data;
  },

  /**
   * Delete a file attachment.
   */
  deleteFile: async (fileId: number): Promise<void> => {
    await api.delete(`/files/${fileId}`);
  },
};

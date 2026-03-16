export interface FileAttachment {
  id: number;
  user_id: number;
  chat_session_id: number | null;
  original_filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
}

export interface FileDownloadResponse {
  url: string;
  expires_in: number;
}

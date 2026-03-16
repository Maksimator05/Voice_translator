import React, { useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  LinearProgress,
  Alert,
  Tooltip,
  Chip,
} from '@mui/material';
import { AttachFile, Upload, Close } from '@mui/icons-material';
import { filesApi } from '../../api/files';
import type { FileAttachment } from '../../types/files';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'text/plain',
  'audio/mpeg',
  'audio/wav',
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadProps {
  chatId: number;
  onUploaded?: (file: FileAttachment) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ chatId, onUploaded, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      setError(`File type "${file.type}" is not allowed. Allowed: JPEG, PNG, GIF, PDF, TXT, MP3, WAV.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${formatBytes(file.size)}). Maximum is 10 MB.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(30);
    setError('');
    try {
      // Simulate progress since axios doesn't easily support upload progress here
      const timer = setTimeout(() => setProgress(70), 300);
      const attachment = await filesApi.uploadFile(chatId, selectedFile);
      clearTimeout(timer);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
        onUploaded?.(attachment);
      }, 400);
    } catch (e: any) {
      setUploading(false);
      setProgress(0);
      setError(e.response?.data?.detail || 'Upload failed');
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {selectedFile ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${selectedFile.name} (${formatBytes(selectedFile.size)})`}
            onDelete={!uploading ? handleClear : undefined}
            deleteIcon={<Close />}
            sx={{
              backgroundColor: 'rgba(124, 58, 237, 0.1)',
              color: '#A78BFA',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              maxWidth: 240,
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
          <Tooltip title="Upload file">
            <span>
              <IconButton
                size="small"
                onClick={handleUpload}
                disabled={uploading || disabled}
                sx={{
                  color: '#7C3AED',
                  backgroundColor: 'rgba(124, 58, 237, 0.1)',
                  '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
                }}
              >
                <Upload fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ) : (
        <Tooltip title="Attach file (JPEG, PNG, GIF, PDF, TXT, MP3, WAV — max 10 MB)">
          <span>
            <IconButton
              size="small"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || disabled}
              sx={{
                color: '#7C3AED',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
              }}
            >
              <AttachFile fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {uploading && (
        <Box sx={{ mt: 0.5, width: '100%', minWidth: 120 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#7C3AED' },
            }}
          />
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Uploading...
          </Typography>
        </Box>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={Array.from(ALLOWED_TYPES).join(',')}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Box>
  );
};

export default FileUpload;

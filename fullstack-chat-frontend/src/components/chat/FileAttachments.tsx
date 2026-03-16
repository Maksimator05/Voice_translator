import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Tooltip,
} from '@mui/material';
import {
  InsertDriveFile,
  Image,
  PictureAsPdf,
  AudioFile,
  Download,
  Delete,
  AttachFile,
} from '@mui/icons-material';
import { filesApi } from '../../api/files';
import type { FileAttachment } from '../../types/files';

interface FileAttachmentsProps {
  chatId: number;
  /** Current user id to determine ownership */
  currentUserId: number;
  isAdmin?: boolean;
  /** Pass to trigger a re-fetch after a new upload */
  refreshToken?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <Image sx={{ color: '#10B981' }} />;
  if (contentType === 'application/pdf') return <PictureAsPdf sx={{ color: '#EF4444' }} />;
  if (contentType.startsWith('audio/')) return <AudioFile sx={{ color: '#EC4899' }} />;
  return <InsertDriveFile sx={{ color: '#94a3b8' }} />;
}

const FileAttachments: React.FC<FileAttachmentsProps> = ({
  chatId,
  currentUserId,
  isAdmin = false,
  refreshToken,
}) => {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await filesApi.getChatFiles(chatId);
      setFiles(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshToken]);

  const handleDownload = async (file: FileAttachment) => {
    setDownloadingId(file.id);
    try {
      const { url } = await filesApi.getFileUrl(file.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to get download URL');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await filesApi.deleteFile(deleteTarget.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to delete file');
    } finally {
      setDeleting(false);
    }
  };

  const canDelete = (file: FileAttachment) =>
    isAdmin || file.user_id === currentUserId;

  if (loading && files.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <CircularProgress size={20} sx={{ color: '#7C3AED' }} />
      </Box>
    );
  }

  if (files.length === 0 && !loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
        <AttachFile sx={{ fontSize: 16, color: '#475569' }} />
        <Typography variant="caption" sx={{ color: '#475569' }}>
          No attachments
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <List dense disablePadding>
        {files.map((file) => (
          <ListItem
            key={file.id}
            disablePadding
            sx={{
              px: 2,
              py: 0.5,
              '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.05)' },
            }}
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Download">
                  <IconButton
                    size="small"
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    sx={{ color: '#7C3AED' }}
                  >
                    {downloadingId === file.id ? (
                      <CircularProgress size={16} sx={{ color: '#7C3AED' }} />
                    ) : (
                      <Download fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                {canDelete(file) && (
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={() => setDeleteTarget(file)}
                      sx={{ color: '#94a3b8', '&:hover': { color: '#EF4444' } }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            }
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {getFileIcon(file.content_type)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" noWrap sx={{ color: '#f1f5f9', maxWidth: 180 }}>
                  {file.original_filename}
                </Typography>
              }
              secondary={
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {formatBytes(file.file_size)}
                </Typography>
              }
            />
          </ListItem>
        ))}
      </List>

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ color: '#f1f5f9' }}>Delete File</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#cbd5e1' }}>
            Are you sure you want to delete "{deleteTarget?.original_filename}"? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            sx={{ color: '#94a3b8' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="contained"
            color="error"
          >
            {deleting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileAttachments;

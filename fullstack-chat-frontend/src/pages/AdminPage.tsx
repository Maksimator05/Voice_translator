// src/pages/AdminPage.tsx
import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { User, UserRole } from '../types/auth';
import { useAppSelector } from '../hooks/useRedux';

const ROLE_COLORS: Record<UserRole, 'default' | 'primary' | 'error'> = {
  guest: 'default',
  user: 'primary',
  admin: 'error',
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  // Диалог подтверждения удаления
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error || 'Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    setSavingId(userId);
    try {
      const updated = await adminApi.updateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error || 'Ошибка изменения роли');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error || 'Ошибка удаления пользователя');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <Box sx={{
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        px: 3, py: 2,
        display: 'flex', alignItems: 'center', gap: 2
      }}>
        <IconButton onClick={() => navigate('/chats')} sx={{ color: '#94a3b8', '&:hover': { color: '#f1f5f9' } }}>
          <ArrowBackIcon />
        </IconButton>
        <AdminPanelSettingsIcon sx={{ color: '#EF4444' }} />
        <Typography variant="h6" sx={{ color: '#f1f5f9', fontWeight: 600 }}>
          Панель администратора — Управление пользователями
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" mt={4}>
            <CircularProgress sx={{ color: '#7C3AED' }} />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 2
          }}>
            <Table>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-root': { borderColor: '#334155', color: '#94a3b8', fontWeight: 600 } }}>
                  <TableCell>ID</TableCell>
                  <TableCell>Имя пользователя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Дата регистрации</TableCell>
                  <TableCell align="center">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{
                      '& .MuiTableCell-root': { borderColor: '#334155', color: '#f1f5f9' },
                      '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.05)' },
                      opacity: !user.is_active ? 0.5 : 1,
                    }}
                  >
                    <TableCell sx={{ color: '#94a3b8 !important' }}>{user.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {user.username}
                      {user.id === currentUser?.id && (
                        <Chip label="Вы" size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem', backgroundColor: 'rgba(124, 58, 237, 0.2)', color: '#A78BFA' }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: '#94a3b8 !important' }}>{user.email}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={user.role}
                          color={ROLE_COLORS[user.role]}
                          size="small"
                        />
                        {/* Изменение роли — нельзя менять себе */}
                        {user.id !== currentUser?.id ? (
                          <>
                            <Select
                              value={user.role}
                              size="small"
                              disabled={savingId === user.id}
                              onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                              sx={{
                                minWidth: 100,
                                color: '#f1f5f9',
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7C3AED' },
                                '& .MuiSelect-icon': { color: '#94a3b8' },
                              }}
                              MenuProps={{
                                PaperProps: {
                                  sx: {
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    '& .MuiMenuItem-root': { color: '#f1f5f9', '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.1)' } }
                                  }
                                }
                              }}
                            >
                              <MenuItem value="guest">guest</MenuItem>
                              <MenuItem value="user">user</MenuItem>
                              <MenuItem value="admin">admin</MenuItem>
                            </Select>
                            {savingId === user.id && (
                              <CircularProgress size={16} sx={{ color: '#7C3AED' }} />
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#64748b', ml: 1 }}>
                            (нельзя изменить себе)
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#94a3b8 !important' }}>
                      {new Date(user.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell align="center">
                      {user.id !== currentUser?.id ? (
                        <Tooltip title="Удалить пользователя">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(user)}
                            sx={{
                              color: '#94a3b8',
                              '&:hover': { color: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box mt={2}>
          <Button
            variant="outlined"
            onClick={loadUsers}
            disabled={loading}
            sx={{
              color: '#7C3AED',
              borderColor: '#7C3AED',
              '&:hover': { borderColor: '#A78BFA', backgroundColor: 'rgba(124, 58, 237, 0.1)' },
            }}
          >
            Обновить список
          </Button>
        </Box>
      </Box>

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 } }}
      >
        <DialogTitle sx={{ color: '#f1f5f9' }}>Удалить пользователя</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#cbd5e1', mb: 1 }}>
            Вы уверены, что хотите удалить пользователя <strong style={{ color: '#f1f5f9' }}>{userToDelete?.username}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            Это действие нельзя отменить. Все данные пользователя будут удалены.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
            sx={{ color: '#94a3b8' }}
          >
            Отмена
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="contained"
            color="error"
            sx={{ backgroundColor: '#ef4444', '&:hover': { backgroundColor: '#dc2626' } }}
          >
            {deleting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;
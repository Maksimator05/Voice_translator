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
  Switch,
  Chip,
  CircularProgress,
  Alert,
  Button,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { User, UserRole } from '../types/auth';

const ROLE_COLORS: Record<UserRole, 'default' | 'primary' | 'warning' | 'error'> = {
  guest: 'default',
  user: 'primary',
  moderator: 'warning',
  admin: 'error',
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

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
      setError(e.response?.data?.error || 'Ошибка загрузки пользователей');
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
      setError(e.response?.data?.error || 'Ошибка изменения роли');
    } finally {
      setSavingId(null);
    }
  };

  const handleActiveToggle = async (userId: number, isActive: boolean) => {
    setSavingId(userId);
    try {
      const updated = await adminApi.toggleUserActive(userId, isActive);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e: any) {
      setError(e.response?.data?.error || 'Ошибка изменения статуса');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <Box sx={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
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
          <TableContainer component={Paper} sx={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-root': { borderColor: '#334155', color: '#94a3b8', fontWeight: 600 } }}>
                  <TableCell>ID</TableCell>
                  <TableCell>Имя пользователя</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Роль</TableCell>
                  <TableCell>Активен</TableCell>
                  <TableCell>Дата регистрации</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{
                      '& .MuiTableCell-root': { borderColor: '#334155', color: '#f1f5f9' },
                      '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.05)' },
                    }}
                  >
                    <TableCell sx={{ color: '#94a3b8 !important' }}>{user.id}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{user.username}</TableCell>
                    <TableCell sx={{ color: '#94a3b8 !important' }}>{user.email}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={user.role}
                          color={ROLE_COLORS[user.role]}
                          size="small"
                        />
                        <Select
                          value={user.role}
                          size="small"
                          disabled={savingId === user.id}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          sx={{
                            minWidth: 120,
                            color: '#f1f5f9',
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7C3AED' },
                            '& .MuiSelect-icon': { color: '#94a3b8' },
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: { backgroundColor: '#1e293b', border: '1px solid #334155', '& .MuiMenuItem-root': { color: '#f1f5f9', '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.1)' } } }
                            }
                          }}
                        >
                          <MenuItem value="guest">guest</MenuItem>
                          <MenuItem value="user">user</MenuItem>
                          <MenuItem value="moderator">moderator</MenuItem>
                          <MenuItem value="admin">admin</MenuItem>
                        </Select>
                        {savingId === user.id && (
                          <CircularProgress size={16} sx={{ color: '#7C3AED' }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active}
                        disabled={savingId === user.id}
                        onChange={(e) => handleActiveToggle(user.id, e.target.checked)}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#94a3b8 !important' }}>
                      {new Date(user.created_at).toLocaleDateString('ru-RU')}
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
    </Box>
  );
};

export default AdminPage;

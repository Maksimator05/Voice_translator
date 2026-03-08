// store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../api/auth';
import { AuthState, LoginCredentials, RegisterCredentials, User, TokenResponse } from '../types';

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('access_token'),
  isLoading: false,
  error: null,
};

// Восстановление состояния из localStorage
const restoreAuthState = () => {
  const token = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('user');

  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      return { user, token };
    } catch (error) {
      console.error('Error parsing stored user:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      return null;
    }
  }
  return null;
};

const saveTokens = (accessToken: string, refreshToken: string, user: User) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearTokens = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// Инициализируем стейт из localStorage
const restoredState = restoreAuthState();
if (restoredState) {
  initialState.user = restoredState.user;
  initialState.token = restoredState.token;
}

export const register = createAsyncThunk(
  'auth/register',
  async (credentials: RegisterCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.register(credentials);
      saveTokens(response.access_token, response.refresh_token, response.user);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Registration failed');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      saveTokens(response.access_token, response.refresh_token, response.user);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Login failed');
    }
  }
);

export const guestLogin = createAsyncThunk(
  'auth/guestLogin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.guestLogin();
      saveTokens(response.access_token, response.refresh_token, response.user);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Guest login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_) => {
    const refreshToken = localStorage.getItem('refresh_token') || '';
    try {
      // Отзываем refresh token на сервере
      await authApi.logout(refreshToken);
    } catch (error: any) {
      // Продолжаем локальную очистку даже если сервер недоступен
    } finally {
      clearTokens();
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authApi.getCurrentUser();
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error: any) {
      clearTokens();
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch user');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearUser: (state) => {
      state.user = null;
      state.token = null;
      clearTokens();
    },
    restoreAuth: (state) => {
      const restored = restoreAuthState();
      if (restored) {
        state.user = restored.user;
        state.token = restored.token;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action: PayloadAction<TokenResponse>) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
        // localStorage уже обновлён в thunk через saveTokens()
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action: PayloadAction<TokenResponse>) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Guest Login
      .addCase(guestLogin.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(guestLogin.fulfilled, (state, action: PayloadAction<TokenResponse>) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.access_token;
      })
      .addCase(guestLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
      })
      .addCase(logout.rejected, (state) => {
        state.user = null;
        state.token = null;
      })
      // Fetch current user
      .addCase(fetchCurrentUser.fulfilled, (state, action: PayloadAction<User>) => {
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null;
        state.token = null;
        // clearTokens() уже вызван в thunk
      });
  },
});


export const { clearError, clearUser, restoreAuth } = authSlice.actions;
export default authSlice.reducer;
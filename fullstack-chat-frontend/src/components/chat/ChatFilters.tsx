import React, { useCallback } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Search, Clear, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  search: string;
  session_type: string;
  date_from: string;
  date_to: string;
  sort_by: string;
  sort_order: string;
}

interface ChatFiltersProps {
  onFiltersChange?: (filters: FilterState) => void;
}

const DARK_INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#0f172a',
    '& fieldset': { borderColor: '#334155' },
    '&:hover fieldset': { borderColor: '#475569' },
    '&.Mui-focused fieldset': { borderColor: '#7C3AED' },
  },
  '& .MuiInputBase-input': { color: '#f1f5f9' },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
};

const ChatFilters: React.FC<ChatFiltersProps> = ({ onFiltersChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (key: string, def = '') => searchParams.get(key) ?? def;

  const filters: FilterState = {
    search: getParam('search'),
    session_type: getParam('session_type'),
    date_from: getParam('date_from'),
    date_to: getParam('date_to'),
    sort_by: getParam('sort_by', 'created_at'),
    sort_order: getParam('sort_order', 'desc'),
  };

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...filters, ...patch };
      const params = new URLSearchParams();
      if (next.search) params.set('search', next.search);
      if (next.session_type) params.set('session_type', next.session_type);
      if (next.date_from) params.set('date_from', next.date_from);
      if (next.date_to) params.set('date_to', next.date_to);
      if (next.sort_by !== 'created_at') params.set('sort_by', next.sort_by);
      if (next.sort_order !== 'desc') params.set('sort_order', next.sort_order);
      setSearchParams(params, { replace: true });
      onFiltersChange?.(next);
    },
    [filters, setSearchParams, onFiltersChange],
  );

  const handleClear = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
    onFiltersChange?.({
      search: '',
      session_type: '',
      date_from: '',
      date_to: '',
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.session_type ||
    filters.date_from ||
    filters.date_to ||
    filters.sort_by !== 'created_at' ||
    filters.sort_order !== 'desc';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, borderBottom: '1px solid #334155' }}>
      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search chats..."
        value={filters.search}
        onChange={(e) => update({ search: e.target.value })}
        sx={DARK_INPUT_SX}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" sx={{ color: '#94a3b8' }} />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {/* Session type filter */}
        <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
          <InputLabel sx={{ color: '#94a3b8' }}>Type</InputLabel>
          <Select
            value={filters.session_type}
            label="Type"
            onChange={(e) => update({ session_type: e.target.value })}
            sx={{
              color: '#f1f5f9',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7C3AED' },
              '& .MuiSvgIcon-root': { color: '#94a3b8' },
            }}
            MenuProps={{ PaperProps: { sx: { backgroundColor: '#1e293b', '& .MuiMenuItem-root': { color: '#f1f5f9' } } } }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="text">Text</MenuItem>
            <MenuItem value="audio">Audio</MenuItem>
            <MenuItem value="meeting">Meeting</MenuItem>
          </Select>
        </FormControl>

        {/* Sort by */}
        <FormControl size="small" sx={{ minWidth: 130, flex: 1 }}>
          <InputLabel sx={{ color: '#94a3b8' }}>Sort by</InputLabel>
          <Select
            value={filters.sort_by}
            label="Sort by"
            onChange={(e) => update({ sort_by: e.target.value })}
            sx={{
              color: '#f1f5f9',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#475569' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#7C3AED' },
              '& .MuiSvgIcon-root': { color: '#94a3b8' },
            }}
            MenuProps={{ PaperProps: { sx: { backgroundColor: '#1e293b', '& .MuiMenuItem-root': { color: '#f1f5f9' } } } }}
          >
            <MenuItem value="created_at">Created At</MenuItem>
            <MenuItem value="updated_at">Updated At</MenuItem>
            <MenuItem value="title">Title</MenuItem>
          </Select>
        </FormControl>

        {/* Sort order toggle */}
        <ToggleButtonGroup
          value={filters.sort_order}
          exclusive
          size="small"
          onChange={(_, val) => val && update({ sort_order: val })}
          sx={{
            '& .MuiToggleButton-root': {
              color: '#94a3b8',
              borderColor: '#334155',
              '&.Mui-selected': {
                backgroundColor: 'rgba(124, 58, 237, 0.2)',
                color: '#A78BFA',
                borderColor: '#7C3AED',
              },
            },
          }}
        >
          <ToggleButton value="asc" title="Ascending">
            <ArrowUpward fontSize="small" />
          </ToggleButton>
          <ToggleButton value="desc" title="Descending">
            <ArrowDownward fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Date range */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          label="From"
          type="date"
          value={filters.date_from}
          onChange={(e) => update({ date_from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ ...DARK_INPUT_SX, flex: 1 }}
        />
        <TextField
          size="small"
          label="To"
          type="date"
          value={filters.date_to}
          onChange={(e) => update({ date_to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          sx={{ ...DARK_INPUT_SX, flex: 1 }}
        />
      </Box>

      {/* Clear button */}
      {hasActiveFilters && (
        <Button
          size="small"
          startIcon={<Clear />}
          onClick={handleClear}
          sx={{
            color: '#94a3b8',
            borderColor: '#334155',
            '&:hover': { color: '#f1f5f9', borderColor: '#475569' },
            alignSelf: 'flex-start',
          }}
          variant="outlined"
        >
          Clear filters
        </Button>
      )}
    </Box>
  );
};

export default ChatFilters;

import { Box, CircularProgress, Typography } from '@mui/material';

export default function PageLoader() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
      }}
    >
      <CircularProgress sx={{ color: '#A78BFA' }} />
      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
        Loading page...
      </Typography>
    </Box>
  );
}

import React, { useState, useRef } from 'react';
import { IconButton, Box, Typography } from '@mui/material';
import { Mic, Stop } from '@mui/icons-material';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access is required for audio recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        sx={{
          bgcolor: isRecording ? '#ef4444' : '#7C3AED',
          color: 'white',
          '&:hover': {
            bgcolor: isRecording ? '#dc2626' : '#5B21B6',
          },
          '&.Mui-disabled': {
            bgcolor: 'rgba(100, 116, 139, 0.3)',
          },
        }}
      >
        {isRecording ? <Stop /> : <Mic />}
      </IconButton>

      {isRecording && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              bgcolor: '#ef4444',
              borderRadius: '50%',
              mr: 1,
              animation: 'pulse 1s infinite',
            }}
          />
          <Typography variant="body2" sx={{ color: '#f1f5f9' }}>
            {formatTime(recordingTime)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
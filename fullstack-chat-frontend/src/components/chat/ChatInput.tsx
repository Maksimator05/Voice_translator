import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { AudioRecorder } from './AudioRecorder';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onSendAudio: (audioFile: File) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendAudio,
  disabled = false,
  isLoading = false,
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isLoading) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    const audioFile = new File([audioBlob], `recording-${Date.now()}.wav`, {
      type: 'audio/wav',
    });
    onSendAudio(audioFile);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="flex flex-col space-y-3">
          <div className="flex space-x-2">
            <AudioRecorder
              onRecordingComplete={handleAudioRecorded}
              disabled={disabled || isLoading}
            />
            <div className="flex-1"></div>
          </div>

          <div className="flex space-x-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here... (Press Enter to send)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={2}
              disabled={disabled || isLoading}
            />

            <Button
              type="submit"
              disabled={!message.trim() || disabled || isLoading}
              isLoading={isLoading}
              className="self-end"
            >
              Send
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            You can type your message or record audio. The AI will analyze both text and voice inputs.
          </div>
        </div>
      </form>
    </div>
  );
};
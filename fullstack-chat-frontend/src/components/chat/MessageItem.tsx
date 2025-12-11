import React from 'react';
import { format } from 'date-fns';

interface MessageItemProps {
  message: {
    id: number;
    content: string;
    role: 'user' | 'assistant';
    message_type: 'text' | 'audio';
    created_at: string;
    audio_filename?: string;
    audio_transcription?: string;
  };
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const timestamp = format(new Date(message.created_at), 'HH:mm');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex max-w-xl ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary-100 ml-3' : 'bg-gray-100 mr-3'
        }`}>
          {isUser ? (
            // Иконка пользователя
            <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          ) : (
            // Иконка AI/робота
            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-600 text-white rounded-tr-none'
              : 'bg-gray-100 text-gray-900 rounded-tl-none'
          }`}>
            {message.message_type === 'audio' ? (
              <div className="flex flex-col space-y-2">
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-2 text-current">
                    <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C9.243 2 7 4.243 7 7V12C7 14.757 9.243 17 12 17C14.757 17 17 14.757 17 12V7C17 4.243 14.757 2 12 2ZM12 20C10.343 20 9 18.657 9 17H15C15 18.657 13.657 20 12 20Z" />
                    </svg>
                  </div>
                  <span>Audio message</span>
                </div>
                {message.audio_transcription && (
                  <div className="mt-2 p-2 bg-black bg-opacity-10 rounded-lg">
                    <p className="text-sm italic">"{message.audio_transcription}"</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
          <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
            {timestamp} • {isUser ? 'You' : 'AI'}
          </div>
        </div>
      </div>
    </div>
  );
};
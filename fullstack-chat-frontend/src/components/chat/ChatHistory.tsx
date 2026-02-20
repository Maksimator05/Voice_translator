import React from 'react';
import { format } from 'date-fns';
import { Chat } from '../../types';
import { Button } from '../ui/Button';

interface ChatHistoryProps {
  chats: Chat[];
  currentChatId: number | null;
  onSelectChat: (chat: Chat) => void;
  onCreateChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onCreateChat,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-25" onClick={onClose} />

      <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-white shadow-xl">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={onCreateChat}
              >
                New Chat
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {chats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No chats yet</p>
                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={onCreateChat}
                >
                  Start New Chat
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      currentChatId === chat.id
                        ? 'bg-primary-50 border border-primary-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {chat.title || 'New Chat'}
                        </p>
                        {chat.last_message && (
                          <p className="text-xs text-gray-500 truncate mt-1">
                            {chat.last_message}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 ml-2">
                        {format(new Date(chat.updated_at), 'MMM d')}
                      </span>
                    </div>
                    <div className="flex items-center mt-2">
                      <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                      <span className="text-xs text-gray-500 ml-2">
                        {(chat.messages?.length ?? 0)} messages
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t">
            <Button
              variant="secondary"
              className="w-full"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { MessageSender } from '../types';

interface ChatBubbleProps {
  sender: MessageSender;
  children: React.ReactNode;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ sender, children }) => {
  const isBot = sender === 'bot';
  
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm ${
        isBot 
          ? 'bg-white text-gray-800 rounded-bl-none border border-gray-100' 
          : 'bg-green-500 text-white rounded-br-none'
      }`}>
        <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;


import React from 'react';

interface ActionPanelProps {
  children: React.ReactNode;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ children }) => {
  return (
    <div className="bg-white border-t border-gray-200 p-4 md:p-6 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
      <div className="max-w-xl mx-auto flex flex-wrap gap-2 justify-center">
        {children}
      </div>
    </div>
  );
};

export default ActionPanel;

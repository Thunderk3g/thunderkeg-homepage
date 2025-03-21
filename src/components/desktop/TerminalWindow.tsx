import React from 'react';
import TerminalChat from '../chat/TerminalChat';

const TerminalWindow: React.FC = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <TerminalChat 
        agentType={'recruiter'} 
        chatId="desktop-terminal"
      />
    </div>
  );
};

export default TerminalWindow; 
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { FormattedChatMessage } from '../services/ChatService';

interface MessageItemProps {
  message: FormattedChatMessage;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box
      className={message.isCurrentUser ? 'user-message' : 'other-message'}
      sx={{
        mb: 1,
        p: 2,
        borderRadius: 2,
        maxWidth: '70%',
        alignSelf: message.isCurrentUser ? 'flex-end' : 'flex-start',
        bgcolor: message.isCurrentUser ? 'primary.light' : 'grey.100',
      }}
    >
      <Typography variant="subtitle2" component="div" fontWeight="bold">
        {message.isCurrentUser ? 'Você' : message.sender}
      </Typography>
      <Typography variant="body1" component="div" sx={{ wordBreak: 'break-word' }}>
        {message.message}
      </Typography>
      <Typography variant="caption" component="div" align="right" color="text.secondary">
        {formatTime(message.timestamp)}
      </Typography>
    </Box>
  );
};

export default MessageItem;

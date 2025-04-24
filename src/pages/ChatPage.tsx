import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  AppBar, 
  Toolbar, 
  IconButton,
  Divider,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUser } from '../contexts/UserContext';
import ChatService, { ChatMessage, FormattedChatMessage, CHAT_RESET_EVENT } from '../services/ChatService';
import MessageItem from '../components/MessageItem';

const ChatPage: React.FC = () => {
  const { nickname, setNickname } = useUser();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<FormattedChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [initiatedReset, setInitiatedReset] = useState(false);
  const navigate = useNavigate();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const chatService = ChatService.getInstance();

  const formatMessages = (messages: ChatMessage[]): FormattedChatMessage[] => {
    return messages.map((msg, index) => ({
      id: `${msg.timestamp}-${index}`,
      sender: msg.sender,
      message: msg.message,
      timestamp: new Date(msg.timestamp),
      isCurrentUser: msg.sender === nickname
    }));
  };

  const handleChatReset = () => {
    if (!initiatedReset) {
      setConnectionError('O chat foi limpo por outro usuário.');
      setTimeout(() => setConnectionError(null), 5000);
    } else {
      setInitiatedReset(false);
    }

    setMessages([]);
  };

  useEffect(() => {
    if (!nickname) {
      navigate('/login');
    }
  }, [nickname, navigate]);

  useEffect(() => {
    chatService.onChatReset(handleChatReset);
    
    return () => {
      chatService.offChatReset(handleChatReset);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    if (nickname) {
      const initializeChat = async () => {
        if (!mounted) return;
        
        setInitialLoading(true);
        try {
          await chatService.connect();
          
          if (!mounted) return;

          const history = await chatService.getMessageHistory();
          
          if (!mounted) return;
          setMessages(formatMessages(history));

        } catch (error) {
          if (!mounted) return;
          
          console.error('[DEBUG] Erro ao inicializar o chat:', error);
          setConnectionError('Não foi possível conectar ao servidor de chat. Usando modo offline.');

          try {
            const history = await chatService.getMessageHistory();
            if (mounted) {
              setMessages(formatMessages(history));
            }
          } catch (restError) {
            console.error('[DEBUG] Também falhou ao buscar via REST:', restError);
          }
        } finally {
          if (mounted) {
            setInitialLoading(false);
          }
        }
      };

      const handleNewMessage = (message: ChatMessage) => {
        if (!mounted) return;
        
        const messageId = `${message.timestamp}-${message.sender}-${message.message}`;
        
        const messageExists = messages.some(
          msg => 
            msg.sender === message.sender && 
            msg.message === message.message && 
            Math.abs(new Date(msg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 1000
        );
        
        if (!messageExists) {
          const formattedMessage: FormattedChatMessage = {
            id: messageId,
            sender: message.sender,
            message: message.message,
            timestamp: new Date(message.timestamp),
            isCurrentUser: message.sender === nickname
          };
          
          setMessages(prev => [...prev, formattedMessage]);
        }
      };

      initializeChat();
      
      chatService.onMessageReceived(handleNewMessage);
      
      return () => {
        mounted = false;
        chatService.offMessageReceived(handleNewMessage);
        chatService.stopPolling();
        chatService.disconnect()
      };
    }
    
    return () => {
      mounted = false;
    };
  }, [nickname]);

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    setSending(true);
    
    const messageText = message;
    
    try {
      setMessage('');
      
      await chatService.sendMessage(nickname, messageText);
      
      setConnectionError(null);
    } catch (error) {
      console.error('[DEBUG] Erro ao enviar mensagem na ChatPage:', error);
      setConnectionError('Não foi possível enviar a mensagem. Tente novamente.');
      
      setMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Atualizar mensagens
  const handleRefreshMessages = async () => {
    setLoading(true);
    try {
      const history = await chatService.getMessageHistory();

      setMessages(formatMessages(history));
      setConnectionError(null);
    } catch (error) {
      console.error('[DEBUG] Erro ao atualizar mensagens na ChatPage:', error);
      setConnectionError('Não foi possível atualizar as mensagens. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetChat = async () => {
    setResetDialogOpen(false);
    console.log('[DEBUG] Iniciando reset do chat');
    setLoading(true);
    
    setInitiatedReset(true);
    
    try {
      await chatService.resetChat();
      
      setConnectionError(null);
    } catch (error) {
      console.error('[DEBUG] Erro ao resetar chat na ChatPage:', error);
      setConnectionError('Não foi possível resetar o chat. Tente novamente.');
      setInitiatedReset(false);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    chatService.disconnect().catch(console.error);
    setNickname('');
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Chat - {nickname}
          </Typography>
          <IconButton 
            color="inherit" 
            aria-label="refresh" 
            onClick={handleRefreshMessages}
            disabled={loading}
            title="Atualizar mensagens"
            sx={{ mr: 1 }}
          >
            <RefreshIcon />
          </IconButton>
          <IconButton 
            color="inherit" 
            aria-label="reset" 
            onClick={() => setResetDialogOpen(true)}
            disabled={loading}
            title="Limpar histórico de chat"
            sx={{ mr: 1 }}
          >
            <DeleteIcon />
          </IconButton>
          <IconButton 
            color="inherit" 
            aria-label="logout" 
            onClick={handleLogout}
            title="Sair do chat"
          >
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      
      <Container 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column',
          py: 2,
          overflow: 'hidden'
        }}
      >
        <Paper 
          elevation={3} 
          sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {initialLoading ? (
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%' 
              }}
            >
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Carregando mensagens...
              </Typography>
            </Box>
          ) : (
            <Box 
              ref={messageContainerRef}
              sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                display: 'flex', 
                flexDirection: 'column',
                padding: 2,
                position: 'relative'
              }}
            >
              {loading && (
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    right: 0, 
                    display: 'flex', 
                    justifyContent: 'center',
                    p: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    zIndex: 1
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              )}
              
              {messages.length === 0 ? (
                <Box 
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    flexDirection: 'column'
                  }}
                >
                  <Typography variant="body1" color="textSecondary">
                    Não há mensagens ainda.
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Seja o primeiro a enviar uma mensagem!
                  </Typography>
                </Box>
              ) : (
                messages.map(msg => (
                  <MessageItem key={msg.id} message={msg} />
                ))
              )}
            </Box>
          )}
          
          <Divider />
          
          <Box 
            component="form" 
            onSubmit={handleSendMessage}
            sx={{ 
              p: 2, 
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending || initialLoading}
              autoFocus
            />
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              endIcon={sending ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
              disabled={sending || !message.trim() || initialLoading}
            >
              {sending ? 'Enviando...' : 'Enviar'}
            </Button>
          </Box>
        </Paper>
      </Container>
      
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
      >
        <DialogTitle>Resetar Chat</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja limpar todo o histórico de conversa? Esta ação não pode ser desfeita e afetará todos os usuários.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleResetChat} color="error" autoFocus>
            Resetar
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={!!connectionError}
        autoHideDuration={6000}
        onClose={() => setConnectionError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setConnectionError(null)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {connectionError}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChatPage;
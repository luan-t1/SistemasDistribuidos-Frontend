import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Avatar,
  Alert,
  Snackbar
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import { useUser } from '../contexts/UserContext';

const LoginPage: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);
  const navigate = useNavigate();
  const { setNickname: setUserNickname } = useUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim()) {
      setError('O nickname é obrigatório');
      setShowError(true);
      return;
    }
    
    if (nickname.length < 3) {
      setError('O nickname deve ter pelo menos 3 caracteres');
      setShowError(true);
      return;
    }
    
    if (nickname.length > 20) {
      setError('O nickname deve ter no máximo 20 caracteres');
      setShowError(true);
      return;
    }
    
    setUserNickname(nickname);
    navigate('/chat');
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
            <ChatIcon />
          </Avatar>
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            Bem-vindo ao Chat
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 2 }}>
            Digite seu nickname para entrar no chat
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="nickname"
              label="Seu Nickname"
              name="nickname"
              autoComplete="nickname"
              autoFocus
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              inputProps={{ maxLength: 20 }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Entrar no Chat
            </Button>
          </Box>
        </Paper>
      </Box>
      
      <Snackbar 
        open={showError} 
        autoHideDuration={6000} 
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowError(false)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default LoginPage;

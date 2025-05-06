import * as signalR from '@microsoft/signalr';
import axios from 'axios';

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
axios.defaults.headers.common['Access-Control-Allow-Origin'] = '*';
axios.defaults.headers.common['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
axios.defaults.headers.common['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

axios.defaults.timeout = 10000; 

const API_BASE_URL = 'https://f6ff-2804-7f2-7900-86bb-cd9f-68fb-a91a-5141.ngrok-free.app/api';

const SIGNALR_URL = 'https://f6ff-2804-7f2-7900-86bb-cd9f-68fb-a91a-5141.ngrok-free.app/chatHub';

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: string;
}

export interface FormattedChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  isCurrentUser: boolean;
}

const RESET_EVENT = new EventTarget();
export const CHAT_RESET_EVENT = 'chat_reset';

class ChatService {
  private connection: signalR.HubConnection;
  private static instance: ChatService | null = null;
  private lastMessageTimestamp: string | null = null;
  private pollingInterval: number | null = null;
  private resetCheckInterval: number | null = null;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];
  private processedMessageIds: Set<string> = new Set();
  private lastResetTime: number = 0; 

  private constructor() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_URL, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Debug)
      .build();

    this.connection.on('ReceiveMessage', (message: ChatMessage) => {
      const messageId = `${message.sender}-${message.message}-${message.timestamp}`;
      
      if (this.processedMessageIds.has(messageId)) {
        return;
      }
      
      this.processedMessageIds.add(messageId);
      
      if (message.timestamp) {
        this.lastMessageTimestamp = message.timestamp;
      }
      
      this.messageCallbacks.forEach(callback => callback(message));
    });

    this.connection.onreconnecting((error) => {
    });

    this.connection.onreconnected((connectionId) => {
    });

    this.connection.onclose((error) => {
      this.ensurePollingActive();
    });

    this.startResetChecking();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  public async connect(): Promise<void> {
    
    if (this.connection.state === signalR.HubConnectionState.Connected) {
      this.ensurePollingActive(); 
      return;
    }
    
    if (this.connection.state === signalR.HubConnectionState.Connecting ||
        this.connection.state === signalR.HubConnectionState.Reconnecting ||
        this.connection.state === signalR.HubConnectionState.Disconnecting) {
      
      return new Promise((resolve, reject) => {
        const checkState = () => {
          if (this.connection.state === signalR.HubConnectionState.Connected) {
            clearInterval(interval);
            this.ensurePollingActive(); 
            resolve();
          } else if (this.connection.state === signalR.HubConnectionState.Disconnected) {
            clearInterval(interval);
            this.connect().then(resolve).catch(reject);
          }
        };
        
        const interval = setInterval(checkState, 500);

        setTimeout(() => {
          clearInterval(interval);
          this.ensurePollingActive();
          reject(new Error('Timeout esperando mudança de estado da conexão'));
        }, 10000);
      });
    }
    
    try {
      await this.connection.start();

      this.ensurePollingActive();
    } catch (error) {
      console.error('[DEBUG] Erro ao conectar via SignalR:', error);
      
      this.ensurePollingActive();
      
      throw error;
    }
  }

  public async sendMessage(nickname: string, message: string): Promise<void> {

    try {
      await this.sendMessageViaRest(nickname, message);
      setTimeout(() => {
        this.getNewMessages().catch(err => 
          console.error('[DEBUG] Erro ao buscar mensagens após envio:', err)
        );
      }, 300);
    } catch (error) {
      console.error('[DEBUG] Erro ao enviar mensagem via REST:', error);
      throw error;
    }
  }

  private async sendMessageViaRest(nickname: string, message: string): Promise<void> {
    try {
      const payload = {
        sender: nickname,
        message: message,
        timestamp: new Date().toISOString()
      };
      const response = await axios.post(`${API_BASE_URL}/Chat/send`, payload);
    } catch (error) {
      console.error('[DEBUG] Erro ao enviar mensagem via REST API:', error);
      try {
        const payload = {
          sender: nickname,
          message: message,
          timestamp: new Date().toISOString()
        };
        const endpoints = [
          'Chat/send',  
          'chat/Send',   
          'chat/message'
        ];
        
        for (const endpoint of endpoints) {
          try {
            const response = await axios.post(`${API_BASE_URL}/${endpoint}`, payload);
            return; 
          } catch (err) {
            console.log(`[DEBUG] Falha com ${endpoint}:`, err);
          }
        }
        throw new Error('Todos os endpoints alternativos falharam');
      } catch (alternativeError) {
        console.error('[DEBUG] Todos os endpoints alternativos falharam:', alternativeError);
        throw error;
      }
    }
  }

  // Verificar status de reset
  private async checkResetStatus(): Promise<void> {
    try {
      const response = await axios.get<ChatMessage[]>(`${API_BASE_URL}/Chat/history`);

      if (response.data.length === 0 && this.processedMessageIds.size > 0) {
        const currentTime = Date.now();
        if (currentTime - this.lastResetTime > 5000) {
          this.lastResetTime = currentTime;
          
          this.processedMessageIds.clear();
          this.lastMessageTimestamp = null;
          
          const resetEvent = new CustomEvent(CHAT_RESET_EVENT);
          RESET_EVENT.dispatchEvent(resetEvent);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao verificar status de reset:', error);
    }
  }

  private startResetChecking(): void {
    if (this.resetCheckInterval !== null) {
      clearInterval(this.resetCheckInterval);
    }
    
    this.resetCheckInterval = window.setInterval(() => {
      this.checkResetStatus().catch(err => 
        console.error('[DEBUG] Erro na verificação de reset:', err)
      );
    }, 5000); 
  }

  public async getMessageHistory(): Promise<ChatMessage[]> {
    try {
      const response = await axios.get<ChatMessage[]>(`${API_BASE_URL}/Chat/history`);

      if (response.data && response.data.length > 0) {
        this.lastMessageTimestamp = response.data[response.data.length - 1].timestamp;

        response.data.forEach(msg => {
          const messageId = `${msg.sender}-${msg.message}-${msg.timestamp}`;
          this.processedMessageIds.add(messageId);
        });
      } else {

        this.processedMessageIds.clear();
        this.lastMessageTimestamp = null;
      }
      
      return response.data;
    } catch (error) {
      console.error('[DEBUG] Erro ao obter histórico de mensagens:', error);
      
      try {
        const endpoints = [
          'Chat/history',  
          'chat/History', 
          'chat/messages', 
          'Chat/messages' 
        ];
        
        for (const endpoint of endpoints) {
          try {
            const response = await axios.get<ChatMessage[]>(`${API_BASE_URL}/${endpoint}`);
            if (response.data && response.data.length > 0) {
              this.lastMessageTimestamp = response.data[response.data.length - 1].timestamp;
              
              response.data.forEach(msg => {
                const messageId = `${msg.sender}-${msg.message}-${msg.timestamp}`;
                this.processedMessageIds.add(messageId);
              });
            }
            
            return response.data;
          } catch (err) {
            console.log(`[DEBUG] Falha com ${endpoint}:`, err);
          }
        }
      } catch (alternativeError) {
        console.error('[DEBUG] Todos os endpoints alternativos falharam:', alternativeError);
      }
      
      return [];
    }
  }

  // Obter novas mensagens
  public async getNewMessages(): Promise<ChatMessage[]> {
    try {
      let url = `${API_BASE_URL}/Chat/history`;
      if (this.lastMessageTimestamp) {
        url += `?since=${encodeURIComponent(this.lastMessageTimestamp)}`;
      }

      const response = await axios.get<ChatMessage[]>(url);
      
      if (response.data.length === 0 && this.processedMessageIds.size > 0) {
        const currentTime = Date.now();
        if (currentTime - this.lastResetTime > 5000) { 
          this.lastResetTime = currentTime;

          this.processedMessageIds.clear();
          this.lastMessageTimestamp = null;

          const resetEvent = new CustomEvent(CHAT_RESET_EVENT);
          RESET_EVENT.dispatchEvent(resetEvent);
          
          return [];
        }
      }
      
      // Se não há mensagens, retorna array vazio
      if (!response.data || response.data.length === 0) {
        return [];
      }

      const newMessages = response.data.filter(msg => {
        const messageId = `${msg.sender}-${msg.message}-${msg.timestamp}`;
        return !this.processedMessageIds.has(messageId);
      });

      if (response.data.length > 0) {
        this.lastMessageTimestamp = response.data[response.data.length - 1].timestamp;
      }
      
      if (newMessages.length > 0) {
        
        newMessages.forEach(message => {
          const messageId = `${message.sender}-${message.message}-${message.timestamp}`;

          if (!this.processedMessageIds.has(messageId)) {
            this.processedMessageIds.add(messageId);
            this.messageCallbacks.forEach(callback => callback(message));
          }
        });
      }

      if (this.processedMessageIds.size > 200) {
        const oldIds = Array.from(this.processedMessageIds).slice(0, this.processedMessageIds.size - 200);
        oldIds.forEach(id => this.processedMessageIds.delete(id));
      }
      
      return newMessages;
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar novas mensagens:', error);
      return [];
    }
  }
  
  private ensurePollingActive(intervalMs: number = 2000): void {
    if (this.pollingInterval !== null) {
      return;
    }
    
    this.startPolling(intervalMs);
  }
  
  public startPolling(intervalMs: number = 2000): void {
    
    if (this.pollingInterval !== null) {
      this.stopPolling();
    }
    
    this.pollingInterval = window.setInterval(async () => {
      await this.getNewMessages().catch(err => 
        console.error('[DEBUG] Erro durante polling:', err)
      );
    }, intervalMs);
  }
  
  public stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  public onChatReset(callback: () => void): void {
    RESET_EVENT.addEventListener(CHAT_RESET_EVENT, callback);
  }

  public offChatReset(callback: () => void): void {
    RESET_EVENT.removeEventListener(CHAT_RESET_EVENT, callback);
  }

  public onMessageReceived(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  public offMessageReceived(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== callback);
  }

  public async resetChat(): Promise<void> {
    try {
      const url = `${API_BASE_URL}/Chat/reset`;

      const response = await axios.post(url);
      this.lastMessageTimestamp = null;
      this.processedMessageIds.clear();
      this.lastResetTime = Date.now();
      
      const resetEvent = new CustomEvent(CHAT_RESET_EVENT);
      RESET_EVENT.dispatchEvent(resetEvent);
      
    } catch (error) {
      console.error('[DEBUG] Erro ao resetar chat:', error);
      throw error;
    }
  }

  // Desconectar
  public async disconnect(): Promise<void> {
    this.stopPolling();
    
    if (this.resetCheckInterval !== null) {
      clearInterval(this.resetCheckInterval);
      this.resetCheckInterval = null;
    }

    if (this.connection.state !== signalR.HubConnectionState.Disconnected) {
      await this.connection.stop();
    }
  }
}

export default ChatService;

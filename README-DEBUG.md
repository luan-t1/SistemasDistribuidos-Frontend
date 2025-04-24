# Instruções para Debug da Aplicação Chat

Este documento contém instruções para depurar problemas de comunicação com o backend na aplicação de chat.

## Logs Adicionados para Debug

Foram adicionados logs detalhados por toda a aplicação que fornecem informações sobre:

1. Estados de conexão SignalR
2. Tentativas de comunicação com o backend 
3. Erros específicos que possam ocorrer
4. Fluxo de execução de métodos importantes

## Como Testar

1. Abra o Console do navegador (F12 > Console)
2. Todos os logs de debug têm o prefixo `[DEBUG]` para facilitar a identificação
3. Execute o fluxo normal da aplicação (login > enviar mensagem > etc.)
4. Observe os logs no console para identificar onde ocorre o problema

## Possíveis Problemas e Soluções

### Problema de CORS

Se ver erros de CORS no console:

```
Access to XMLHttpRequest at 'https://localhost:7099/api/Chat/send' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solução**: O backend precisa permitir requisições da origem do frontend. Modifique o `Program.cs` do backend:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000") // Origem do frontend
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

### Problema de Certificado SSL

Se ver erros de certificado no console:

```
NET::ERR_CERT_AUTHORITY_INVALID
```

**Solução**: 
1. Acesse diretamente `https://localhost:7099` no navegador
2. Aceite o certificado clicando em "Avançado" > "Prosseguir para localhost (não seguro)"

### Problema de Conexão SignalR

Se ver erros como:

```
Error: Failed to start the connection: Error: Cannot send data if the connection is not in the 'Connected' State.
```

**Solução**:
1. Verifique se o servidor está rodando
2. Verifique a URL do hub SignalR no arquivo `ChatService.ts`
3. O hub SignalR está mapeado em `/chatHub` no backend?

### Endpoints da API REST

Se ver erros com status 404 (Not Found):

```
404 (Not Found) para https://localhost:7099/api/Chat/send
```

**Solução**:
1. Verifique os endpoints exatos no controlador do backend
2. Pode haver diferenças de capitalização (e.g., `/chat/send` vs `/Chat/send`)
3. A aplicação já tenta várias combinações como fallback

## Redis

Se o backend não conseguir se conectar ao Redis, pode causar erros 500 no frontend:

```
500 (Internal Server Error)
```

Verifique se o Redis está rodando:

```bash
docker ps
```

Ou reinicie o Redis:

```bash
docker restart redistest
```

## Teste Direto das APIs

Use estes comandos curl para testar as APIs diretamente:

```bash
# Obter histórico
curl -k https://localhost:7099/api/Chat/history

# Enviar mensagem
curl -k -X POST https://localhost:7099/api/Chat/send \
  -H "Content-Type: application/json" \
  -d '{"sender":"TestUser","message":"Test message","timestamp":"2023-01-01T12:00:00Z"}'

# Resetar chat
curl -k -X POST https://localhost:7099/api/Chat/reset
```

O parâmetro `-k` ignora erros de certificado SSL.

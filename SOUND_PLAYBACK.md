# Rastreamento de Áudio (Sound Playback Tracking)

Este guia explica como rastrear quando um usuário toca um áudio no servidor.

## 📋 Configuração

### 1. Fazer Migração do Banco de Dados

Execute a migração para criar a tabela de histórico de playback:

```bash
npm run db:push
```

Isso criará o modelo `ServerSoundPlayback` com os seguintes campos:
- `id` - ID único do registro
- `soundId` - ID do áudio tocado
- `userId` - ID do usuário que tocou
- `serverId` - ID do servidor onde foi tocado
- `playedAt` - Timestamp de quando foi tocado

## 📡 API Endpoints

### POST `/api/servers/[serverId]/sounds/[soundId]/playback`

Registra que um usuário tocou um áudio.

**Body:**
```json
{
  "serverId": "server-id"
}
```

**Response:**
```json
{
  "id": "playback-id",
  "playedAt": "2026-08-18T12:00:00Z",
  "user": {
    "id": "user-id",
    "username": "john_doe",
    "displayName": "John"
  }
}
```

**Exemplo com cURL:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: twinslkit_auth=YOUR_TOKEN" \
  -d '{"serverId":"server-123"}' \
  "http://localhost:3000/api/servers/server-123/sounds/sound-456/playback"
```

### GET `/api/servers/[serverId]/sounds/[soundId]/playback-history`

Busca o histórico de quem tocou um áudio.

**Parâmetros de Query:**
- `limit` (number): Número máximo de registros (padrão: 50, máximo: 100)
- `offset` (number): Deslocamento para paginação (padrão: 0)

**Response:**
```json
{
  "playbacks": [
    {
      "id": "playback-id",
      "playedAt": "2026-08-18T12:00:00Z",
      "user": {
        "id": "user-id",
        "username": "john_doe",
        "displayName": "John",
        "avatarUrl": "https://..."
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150
  }
}
```

**Exemplo com cURL:**
```bash
curl -H "Cookie: twinslkit_auth=YOUR_TOKEN" \
  "http://localhost:3000/api/servers/server-123/sounds/sound-456/playback-history?limit=20&offset=0"
```

## 🎯 Como Usar no Frontend

### Importar Helpers

```typescript
import { recordSoundPlayback, getSoundPlaybackHistory } from "@/lib/sound-playback";
```

### Registrar um Playback

Quando o usuário clicar para tocar um áudio:

```typescript
const handlePlaySound = async (soundId: string, serverId: string) => {
  try {
    const playback = await recordSoundPlayback(soundId, serverId);
    console.log("Playback registrado:", playback);
    // Tocar o áudio
    playAudio(soundId);
  } catch (error) {
    console.error("Erro ao registrar playback:", error);
  }
};
```

### Buscar Histórico

Para ver quem tocou um áudio:

```typescript
const handleViewHistory = async (soundId: string) => {
  try {
    const data = await getSoundPlaybackHistory(soundId, 50, 0);
    console.log("Histórico:", data.playbacks);
    // Mostrar quem tocou
    data.playbacks.forEach(playback => {
      console.log(`${playback.user.displayName} tocou em ${playback.playedAt}`);
    });
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
  }
};
```

## 💡 Exemplo Completo de Uso

```typescript
// Component.tsx
import { useState, useEffect } from "react";
import { recordSoundPlayback, getSoundPlaybackHistory } from "@/lib/sound-playback";

export function SoundPlayer({ soundId, serverId, soundName }: { soundId: string; serverId: string; soundName: string }) {
  const [playbackHistory, setPlaybackHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePlaySound = async () => {
    try {
      // Registrar que o usuário tocou o áudio
      await recordSoundPlayback(soundId, serverId);
      
      // Tocar o áudio
      const audio = new Audio(`/api/sounds/${soundId}`);
      audio.play();
    } catch (error) {
      console.error("Erro ao tocar áudio:", error);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getSoundPlaybackHistory(soundId, 20, 0);
      setPlaybackHistory(data.playbacks);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sound-player">
      <h3>{soundName}</h3>
      
      <button onClick={handlePlaySound} className="play-button">
        ▶️ Tocar
      </button>

      <button onClick={loadHistory} className="history-button">
        📊 Ver Quem Tocou
      </button>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <div className="history-list">
          <h4>Últimos a Tocar:</h4>
          {playbackHistory.length === 0 ? (
            <p>Ninguém tocou este áudio ainda</p>
          ) : (
            <ul>
              {playbackHistory.map((playback) => (
                <li key={playback.id}>
                  <strong>{playback.user.displayName}</strong> (@{playback.user.username})
                  <span className="time">
                    {new Date(playback.playedAt).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

## 📊 Estatísticas de Áudio

Você pode usar os dados de playback para gerar estatísticas:

```typescript
// Exemplo: Contar quantas vezes um áudio foi tocado
export async function getPlaybackStats(soundId: string) {
  const response = await fetch(
    `/api/servers/[serverId]/sounds/${soundId}/playback-history?limit=1000`
  );
  
  const data = await response.json();
  
  return {
    totalPlaybacks: data.pagination.total,
    playbacksLast24h: data.playbacks.filter(p => 
      new Date(p.playedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length,
    uniqueUsers: new Set(data.playbacks.map(p => p.user.id)).size,
    topPlayers: Object.entries(
      data.playbacks.reduce((acc: any, p: any) => {
        acc[p.user.id] = (acc[p.user.id] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([userId, count]) => ({ userId, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10)
  };
}
```

## 🔍 Banco de Dados

### Índices para Performance

O modelo `ServerSoundPlayback` possui os seguintes índices:
- `soundId + playedAt` - Para buscar histórico de um áudio
- `userId + playedAt` - Para buscar histórico de um usuário
- `serverId + playedAt` - Para buscar histórico de um servidor
- `soundId + userId + playedAt` - Para análise detalhada

### Queries Úteis (Prisma)

```typescript
// Contar playbacks de um áudio
const count = await db.serverSoundPlayback.count({
  where: { soundId: "sound-123" }
});

// Últimas 10 vezes que foi tocado
const playbacks = await db.serverSoundPlayback.findMany({
  where: { soundId: "sound-123" },
  orderBy: { playedAt: "desc" },
  take: 10,
});

// Quantas vezes um usuário tocou um áudio
const userPlaybacks = await db.serverSoundPlayback.count({
  where: {
    soundId: "sound-123",
    userId: "user-456"
  }
});

// Áudios mais tocados em um servidor
const topSounds = await db.serverSoundPlayback.groupBy({
  by: ["soundId"],
  where: { serverId: "server-123" },
  _count: { id: true },
  orderBy: { _count: { id: "desc" } },
  take: 10,
});
```

## 📝 Notas

- Cada toque é registrado como um novo registro no banco de dados
- Não há limite de quantas vezes um áudio pode ser tocado ou registrado
- O timestamp é sempre em UTC (salvo com `@default(now())`)
- Todos os registros são deletados quando o áudio é deletado (cascade)
- O histórico pode crescer bastante em aplicações com muitos usuários - considere arquivar dados antigos periodicamente

# Painel Administrativo

Este guia explica como usar o painel administrativo para gerenciar usuários.

## 📋 Configuração Inicial

### 1. Fazer Migração do Banco de Dados

Primeiro, você precisa executar a migração para adicionar o campo `isAdmin` aos usuários:

```bash
npx prisma db push
```

### 2. Promover um Usuário para Administrador

Para acessar o painel administrativo, você precisa ter um usuário com permissão de admin. Use o script fornecido:

```bash
npm run promote-admin -- seu-username
```

Exemplo:
```bash
npm run promote-admin -- john_doe
```

Se funcionou, você verá:
```
✅ Usuário "john_doe" promovido a administrador com sucesso!
📱 Acesse o painel em: http://localhost:3000/admin
```

## 🛡️ Acessar o Painel

1. Faça login com sua conta de administrador
2. Acesse: `http://localhost:3000/admin`

## 👥 Funcionalidades

### Listar Usuários
- **Buscar**: Use a barra de pesquisa para filtrar por nome de usuário ou nome de exibição
- **Paginação**: Navegue entre as páginas de usuários
- **Informações**: Veja username, nome de exibição, status de admin e data de criação

### Editar Usuário
1. Clique no botão "Editar" na linha do usuário
2. Você pode alterar:
   - **Nome de Usuário**: O identificador único do usuário
   - **Nome de Exibição**: O nome mostrado publicamente
   - **Senha**: Deixe em branco para não alterar
   - **Status de Admin**: Marque para fazer o usuário um administrador

3. Clique em "Salvar" para aplicar as mudanças

### Deletar Usuário
1. Clique no botão "Deletar" na linha do usuário
2. Confirme a exclusão
3. O usuário será permanentemente removido

⚠️ **Aviso**: Todas as suas atividades (mensagens, amigos, servidores, etc.) também serão deletadas.

## 🔐 Segurança

- Apenas usuários com `isAdmin = true` podem acessar o painel
- Um administrador não pode deletar sua própria conta
- Todas as ações de modificação requerem autenticação
- As requisições são protegidas por token de autenticação

## 📡 API Endpoints

Se você quiser usar os endpoints da API diretamente:

### GET `/api/admin/users`
Lista todos os usuários com paginação e busca.

**Parâmetros de Query:**
- `page` (number): Número da página (padrão: 1)
- `pageSize` (number): Itens por página (padrão: 20, máximo: 50)
- `search` (string): Termo de busca

**Exemplo:**
```bash
curl -H "Cookie: twinslkit_auth=YOUR_TOKEN" \
  "http://localhost:3000/api/admin/users?page=1&pageSize=20&search=john"
```

### PATCH `/api/admin/users/[userId]`
Atualiza um usuário específico.

**Body:**
```json
{
  "username": "novo_username",
  "displayName": "Novo Nome",
  "password": "nova_senha",
  "isAdmin": true
}
```

**Exemplo:**
```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "Cookie: twinslkit_auth=YOUR_TOKEN" \
  -d '{"displayName":"Novo Nome","isAdmin":false}' \
  "http://localhost:3000/api/admin/users/USER_ID"
```

### DELETE `/api/admin/users/[userId]`
Deleta um usuário.

**Exemplo:**
```bash
curl -X DELETE \
  -H "Cookie: twinslkit_auth=YOUR_TOKEN" \
  "http://localhost:3000/api/admin/users/USER_ID"
```

## 🐛 Troubleshooting

### "Você não tem permissão para acessar esta página"
- Sua conta não é um administrador
- Execute: `npm run promote-admin -- seu-username`

### "Erro ao carregar usuários"
- Verifique se está logado
- Verifique a conexão com o banco de dados
- Veja o console do servidor para mais detalhes

### Migração falhou
- Execute: `npm run db:push`
- Se falhar, verifique se sua conexão com banco de dados está correta

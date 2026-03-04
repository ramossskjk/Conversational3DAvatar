# ✦ Kira — AI VTuber

Projeto base de uma VTuber com IA integrada, feita com React + Vite + Claude API.

---

## 📁 Estrutura do Projeto

```
kira-vtuber/
├── .env                              # Chaves de API (não subir pro Git!)
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                       # Componente raiz (configure VRM_URL aqui)
    │
    ├── components/
    │   ├── Avatar.jsx                # Avatar SVG animado (padrão)
    │   ├── AvatarVRM.jsx             # Avatar 3D com modelo .vrm
    │   ├── StreamFrame.jsx           # Moldura live + seletor de humor
    │   ├── ChatPanel.jsx             # Painel de chat
    │   └── BackgroundParticles.jsx   # Partículas decorativas
    │
    ├── hooks/
    │   ├── useKiraChat.js            # Lógica de chat e estado
    │   └── useVoice.js               # Síntese de voz (ElevenLabs ou Web Speech)
    │
    ├── services/
    │   ├── claudeApi.js              # API do Claude (Anthropic)
    │   └── openaiApi.js              # API do ChatGPT (OpenAI) — opcional
    │
    ├── constants/
    │   ├── moods.js                  # Humores e parâmetros visuais
    │   └── persona.js                # System prompt e mensagens da Kira
    │
    └── styles/
        └── globals.css               # Animações e estilos globais
```

---

## 🚀 Como rodar

```bash
npm install
npm run dev
```

---

## 🔑 Variáveis de ambiente (.env)

```env
# IA (escolha uma)
VITE_OPENAI_KEY=sk-proj-...          # ChatGPT (pago por uso)
# Claude funciona sem chave no ambiente Claude.ai

# Voz (opcional — sem chave usa Web Speech API grátis)
VITE_ELEVENLABS_KEY=...
VITE_ELEVENLABS_VOICE_ID=...         # ID da voz no ElevenLabs
```

---

## 🎭 Ativar modelo 3D VRM

1. Instale as dependências:
```bash
npm install three @pixiv/three-vrm
```

2. Coloque seu arquivo `.vrm` em `/public/kira.vrm`

3. No `src/App.jsx`, troque:
```js
const VRM_URL = null;
// para:
const VRM_URL = "/kira.vrm";
```

**Onde conseguir um modelo VRM:**
- Criar: [vroid.com](https://vroid.com) — gratuito
- Comprar: [booth.pm](https://booth.pm) — marketplace japonês
- Encomendar: Fiverr / Twitter com `#VRoidCommission`

---

## 🎙️ Ativar voz (ElevenLabs)

1. Crie conta em [elevenlabs.io](https://elevenlabs.io)
2. Crie uma voz para a Kira
3. Copie a API Key e o Voice ID
4. Adicione no `.env`:
```env
VITE_ELEVENLABS_KEY=sua_chave
VITE_ELEVENLABS_VOICE_ID=id_da_voz
```

Sem configurar ElevenLabs, o projeto usa a **Web Speech API** do browser automaticamente (grátis, qualidade menor).

---

## 🛠️ Próximas features sugeridas

- [ ] Leitura do chat do YouTube/Twitch em tempo real
- [ ] Modo "stream overlay" (fundo transparente para OBS)
- [ ] Memória de conversa entre sessões
- [ ] Múltiplos personagens / personas
- [ ] STT — falar com a Kira pelo microfone

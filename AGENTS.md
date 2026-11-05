# AGENTS.md — Diretrizes para o Codex no Junta

Você está trabalhando no projeto **Junta**, um app independente para divisão de despesas em grupo. Leia **PROJECT.md** integralmente antes de propor arquitetura ou editar arquivos. Ele é a fonte principal de requisitos de produto.

## Objetivo
Entregar um MVP real, **mobile-first, PWA instalável no iPhone**, utilizável por pelo menos três pessoas em celulares diferentes, com dados sincronizados via Supabase. O app deve continuar simples como a experiência geral do Tricount, mas com identidade visual e código originais.

## Prioridades
1. Qualidade e simplicidade do fluxo: criar/entrar em grupo → adicionar despesa → fotografar nota (opcional) → revisar campos → selecionar participantes por item → salvar → visualizar saldos.
2. Persistência real, sincronização, autenticação e autorização (RLS) antes de recursos secundários.
3. Valores monetários sempre em **centavos inteiros**; soma e distribuição exatas, com centavos de diferença distribuídos deterministicamente.
4. OCR/visão é **assistente de preenchimento**, nunca a fonte inquestionável: permitir revisar e corrigir tudo, inclusive título, data, total, item, quantidade, valor, pagador e consumidores.
5. Nunca inventar dados ausentes da nota; sinalizar confiança baixa e diferenças entre soma dos itens e total.
6. Projeto acessível e legível; evita overengineering, infraestrutura cara, componentes e integrações desnecessários.

## Implementação
- Preferir Next.js/React + TypeScript e Supabase (PostgreSQL, Auth, Storage privado e Realtime) + Vercel, ajustando apenas com justificativa documentada.
- Confirmar o estado real do repositório: ele pode ter apenas README e nenhum projeto implementado.
- Criar migrações SQL reproduzíveis, README com setup detalhado, .env.example sem segredos, componentes reutilizáveis e testes da matemática financeira/RLS.
- Convites via link compartilhável, incluindo WhatsApp, **sem dependência obrigatória de API oficial do WhatsApp**. Permitir participantes criados por nome e vinculação posterior a uma conta sem duplicar dívidas.
- Teste com acesso simples; avaliar Supabase Anonymous Auth para protótipo, explicando claramente os riscos de perda de conta, e oferecer estratégia de migração para login permanente.
- Não publicar segredos. Chave da API de IA somente no servidor; limitar upload, validar tipos e controlar acesso aos comprovantes.
- Tratar erros de rede, foto ilegível, campos faltantes, ausência de chave da IA, sessão inválida e atualização simultânea.
- Evitar cópia de código, textos, imagens ou design proprietário do Tricount; inspiração apenas em conceitos e simplicidade.
- Não registrar custos nem efetuar deploy real sem credenciais e configuração necessárias. Nunca alegar que uma funcionalidade está funcionando sem execução/teste.

## Fluxo de trabalho
- Antes de codar: inspecione arquivos e faça plano curto por etapas.
- Implemente MVP funcional, não apenas mockup; priorize testes rodando.
- Execute build, lint e testes quando disponíveis; anote resultados reais e limitações.
- Prepare PR com descrição de mudanças, checklist de testes, instruções de configuração de Supabase/Vercel e pendências.
- Se faltar acesso a Supabase/Vercel ou chave de IA, isole integração via variáveis de ambiente e forneça procedimento claro, sem bloquear a implementação local.

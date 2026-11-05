# PROJECT.md — Especificação do Junta

**Estado:** escopo do MVP acordado. Nome de trabalho: **Junta**. Repositório GitHub: `vagner-cv/junta-app` (privado). Idioma do produto: português do Brasil; moeda inicial: BRL; datas em formato brasileiro na interface.

## 1. Visão e posicionamento
Criar um aplicativo pequeno e muito simples de **despesas compartilhadas**, inspirado na proposta geral do Tricount: grupos, lançamentos, lista de despesas, quem pagou, quem deve e saldos. **Diferencial central:** fotografar uma nota fiscal ou comprovante e usar IA para preencher automaticamente o lançamento, extraindo **cada produto separadamente** para que o usuário marque **quem participa de cada item**.

É um produto independente; não copiar marca, layout pixel a pixel, textos, ativos ou código do Tricount. Crescer de maneira incremental conforme feedback de uso real, sem ampliar artificialmente o MVP.

## 2. Público e situação do primeiro teste
Primeiro teste: três colegas de apartamento, cada um usando seu próprio smartphone (incluindo iPhone), com lançamentos compartilhados e mudanças visíveis para os demais. Deve funcionar via link HTTPS, com opção de instalar na tela inicial do iPhone usando Safari (**PWA**). Não exigir publicação inicial na App Store nem conta Apple Developer. Outros usuários poderão usar futuramente.

## 3. Jornada principal
1. Abrir o app e obter uma identidade simples (idealmente sem fricção).
2. Criar grupo (ex.: Apartamento) e adicionar membros por nome; gerar convite compartilhável por WhatsApp/link.
3. Colegas entram no mesmo grupo e passam a visualizar despesas e saldos. Não exigir que o criador tenha números de WhatsApp; poder preencher número opcionalmente para abrir convite direcionado.
4. Tocar **Adicionar despesa** (manualmente ou com foto).
5. Foto de nota fiscal/comprovante: salvar a imagem privada e enviar ao backend para reconhecimento por IA, quando configurada.
6. IA sugere **título** (ex.: 'Supermercado — compras da semana'), **valor total**, **data**, **estabelecimento**, e lista de **produtos** (descrição, quantidade e valor total da linha; se disponível, valor unitário).
7. Exibir todos os campos editáveis; usuário confere/corrige nome, preços, data, título, pagador e foto. Quando não houver IA ou a imagem for ilegível, permitir lançamento manual completo.
8. Em cada produto mostrar checkboxes de todos os membros do grupo. Seleção independente por item. Cada item é dividido igualmente entre os marcados, e somente entre eles. Atalho 'Selecionar todos'/'Limpar' é desejável.
9. Escolher **quem pagou** a despesa. Salvar e recalcular os saldos imediatamente.
10. Histórico e saldos sincronizados entre celulares; comprovante original pode ser consultado com permissão.
11. Acerto de dívidas/registro de pagamentos deve fazer parte do uso normal de um app desse tipo; priorizar após o núcleo de despesas, ou incluir no MVP se couber sem comprometer qualidade.

## 4. Tipos de comprovante e limites da IA
- **Nota fiscal com múltiplos itens:** tentar extrair um item por produto/linha e quantidade/preço total.
- **Boleto, conta de luz, recibo único:** sugerir título, valor, data relevante, e um item único de despesa quando não houver lista de produtos. Distinguir vencimento de data de emissão/pagamento; não inventar data.
- A IA **não deve inventar** informações ilegíveis ou não presentes; campos incertos ficam em branco ou são marcados para revisão.
- Conferir soma dos itens versus total; descontos, taxas e arredondamentos precisam ser apresentados ou ajustados de modo transparente. Não ocultar divergência e não salvar divisão inconsistente.
- A foto pode ficar anexada mesmo sem integração de IA.
- A imagem será enviada apenas através de endpoint seguro; API key armazenada somente no servidor.
- Visão pode errar; interface deve sempre exigir conferência antes de confirmar.

## 5. Regras de negócio
- Um grupo tem vários membros e várias despesas.
- Uma despesa tem título, data, valor total, pagador, foto opcional e N itens.
- Um item tem descrição, quantidade, preço total e uma lista de membros consumidores.
- Valor de cada item / número de participantes marcados = parte de cada um; tudo em centavos inteiros, incluindo rateio determinístico dos centavos residuais.
- Exemplo: arroz R$ 24 entre A, B e C = R$ 8 cada; café R$ 18 só entre A e B = R$ 9 cada; banana R$ 8 só de A = R$ 8 só de A.
- Não permitir item sem consumidor na confirmação.
- Se o documento não tem itens, gerar item único que representa o valor total para permitir seleção.
- Soma dos valores dos itens (incluindo eventuais linhas de ajustes explícitas) deve bater com o total.
- Quem pagou recebe crédito do total; cada consumidor fica devedor da parcela correspondente, inclusive se pagou a compra.
- Ao acumular várias despesas, calcular saldo líquido de todos os lançamentos e pagamentos registrados.
- Valores, quem pagou e consumidores devem ser persistidos no backend. Não limitar dados ao localStorage do navegador.
- Preservar histórico correto quando houver alteração de nome ou entrada de usuário em um membro anteriormente cadastrado.
- Evitar duplicação de lançamento ao clicar mais de uma vez ou repetir requisições.

## 6. Funcionalidades do MVP
**Obrigatórias:**
- Interface mobile-first limpa, poucas telas: grupos, detalhe do grupo (despesas/saldos), adicionar/revisar despesa, detalhes da despesa.
- Criação de grupo e membros, convite pelo WhatsApp/link, vários celulares no mesmo grupo.
- Lançamento manual completo.
- Captura/anexo de foto no iPhone, com fluxo de IA opcional para pré-preencher dados, e correção manual.
- Checkbox de consumidores **por produto**, distribuição exata e atualização de saldos.
- Armazenamento seguro de fotos, autorização por grupo, atualização automática entre dispositivos.
- PWA com ícone/manifest e site HTTPS.
- Tratamento de erros e instruções para deploy.

**Muito importantes depois do núcleo pronto:** editar/excluir despesas (com autorização), registrar pagamentos/quitá-los, simplificação de transferências e histórico de acertos, saída segura de grupos, gestão de membros e login permanente.

**Fora do primeiro escopo:** Pix integrado e pagamento real, notificações push, importação de notas por QR Code, relatórios avançados, assinatura/monetização, contas bancárias e funcionalidades empresariais. Avaliar futuramente.

## 7. Infraestrutura planejada
- Frontend: Next.js / React (preferir TypeScript e componentes responsivos).
- Hospedagem: Vercel, via integração com GitHub para deploy após alterações aprovadas.
- Backend gerenciado: Supabase (Postgres, Auth, Storage privado, Realtime).
- IA de visão: API server-side de modelo multimodal configurável; cobrança por uso e chave secreta fora do navegador.
- Ambiente de teste: planos gratuitos inicialmente, respeitando limites e termos de cada serviço.
- Segredos não devem ir ao repositório. Criar `.env.example` e documentar quais chaves podem ter prefixo `NEXT_PUBLIC_`.
- Fazer RLS efetivo para grupos, despesas, itens, saldos e imagens; convidado só entra com convite seguro; não expor dados pessoais/financeiros para outros grupos.
- Sem contas Supabase/Vercel conectadas diretamente, entregar migrations e guia passo a passo. Não afirmar publicação até ter URL real e confirmar.

## 8. Critérios de aceite verificáveis
1. Usuário A cria grupo e convida B e C por WhatsApp; ambos entram via link.
2. A lança uma despesa manual de R$ 50 paga por A com dois itens: R$ 30 dividido entre A e B e R$ 20 dividido entre B e C. Saldos: A +R$35, B -R$25, C -R$10.
3. Para valor que não divide exatamente (ex.: R$ 10,00 entre três), a soma de todas as parcelas totaliza exatamente R$ 10,00.
4. Se B adicionar uma despesa, A e C a visualizam sem recarregar manualmente enquanto conectados.
5. Foto no iPhone abre câmera/galeria, fica armazenada e acessível apenas aos membros autorizados.
6. Se a IA estiver configurada, preenche título/data/total/itens e não salva nada sem revisão; sem chave, segue por cadastro manual.
7. Erro de IA, nota ilegível ou divergência de total mostra aviso claro; não inventar produtos nem data.
8. Sair de um grupo ou não participar dele não permite ler suas despesas nem imagens.
9. Aplicativo abre como PWA no iPhone após Adicionar à Tela de Início.
10. Comandos de instalação/build/testes foram executados e resultados constam do PR/README.

## 9. Orientações de UX
- Muito simples: evitar processos longos, menus e formulários desnecessários.
- Tela de cadastro manual parecida em propósito com adicionar despesa de apps de rateio, sem replicar design protegido.
- IA é apenas um botão/atalho ('Fotografar nota'), não bloqueia o uso manual.
- Participantes por item devem ser claramente visíveis e fáceis de tocar no celular.
- Preferência por habilitar todos os membros inicialmente quando fizer sentido, mas permitir desmarcar individualmente.
- Mostrar valores em R$ com duas casas, datas dd/mm/aaaa e nomes de participantes.
- Deixar claro saldo a receber, saldo a pagar e quem pagou.
- Identidade visual própria, visual leve e legibilidade no iPhone.

## 10. Entregável esperado do Codex
Código funcional e revisável, testes, migrações SQL, instruções de deploy Vercel/Supabase e configuração da leitura por IA, arquivos de ambiente de exemplo e um PR resumindo mudanças, verificações e limitações. Se o repo ainda tiver só README, implementar desde o início.

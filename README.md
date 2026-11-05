# Junta

Aplicativo em português do Brasil para dividir despesas de um grupo em reais. Cada produto tem seus próprios consumidores. O saldo credita o total ao pagador e desconta de cada pessoa apenas sua parcela dos itens que consumiu.

## Rodar localmente

1. Use Node.js 22 ou superior e rode `npm ci`.
2. Crie um projeto Supabase. Habilite **Anonymous Sign-Ins** nas configurações de autenticação.
3. No SQL Editor do Supabase, execute, uma vez e em ordem, os arquivos de `supabase/migrations/`. Eles criam as tabelas, regras de acesso, convites, armazenamento privado e publicação Realtime.
4. Copie `.env.example` para `.env.local`. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com a URL e a chave **publishable** do projeto. Essas duas variáveis vão para o navegador. Nunca use a chave secreta ou service role nesse arquivo com prefixo público.
5. Rode `npm run dev` e acesse `http://localhost:3000`.

A sessão anônima fica no navegador. Limpar os dados do site ou trocar de aparelho pode fazer o usuário perder acesso ao perfil e ao histórico vinculado a ele. Para um ambiente público, configure as proteções contra abuso do Supabase e implemente CAPTCHA antes de liberar inscrições anônimas. O caminho para uma conta permanente é vincular um e-mail à sessão existente, preservando o mesmo ID de usuário e, portanto, o vínculo com o grupo.

## Leitura opcional de comprovantes

Configure `OPENAI_API_KEY` e `OPENAI_VISION_MODEL` no servidor para usar um modelo com visão e saídas estruturadas. O app solicita a leitura quando a pessoa toca **Ler campos com IA**. Nesse momento, o servidor envia a foto à OpenAI e recebe apenas sugestões de preenchimento. A confirmação dos dados é feita no formulário. [Documentação de visão](https://developers.openai.com/api/docs/guides/images-vision) · [Saídas estruturadas](https://developers.openai.com/api/docs/guides/structured-outputs)

A leitura aceita JPEG, PNG e WebP até 4 MB. Comprovantes JPEG, PNG, WebP e HEIC/HEIF até 8 MB podem ser anexados à despesa mesmo quando a leitura está desabilitada. Os arquivos ficam no bucket privado `receipts`. O app gera links temporários de 60 segundos para abri-los. Se o upload terminar e a gravação falhar, mantenha o formulário aberto para repetir o envio com o mesmo identificador. Arquivos de tentativas abandonadas podem exigir limpeza administrativa.

## Hospedar e instalar

1. Importe este repositório na Vercel e selecione o preset **Next.js** e Node.js 22 ou superior.
2. Configure as duas variáveis públicas do Supabase. Configure as variáveis de IA apenas se a leitura for desejada.
3. Após o deploy, abra a URL HTTPS. Em um iPhone, abra no Safari, toque em **Compartilhar** e selecione **Adicionar à Tela de Início**. O app precisa de internet para acessar os dados.
4. Crie um grupo, envie o convite por WhatsApp e abra em outros dois aparelhos. Quem já tiver sido cadastrado por nome pode selecionar seu participante ao entrar. Compartilhe o link somente com quem deve ter acesso ao grupo.

## Verificação

- `npm test` executa os testes de rateio e das migrações. Os testes do banco usam Postgres em WASM com papéis e funções mínimas do Supabase.
- `npm run lint` verifica os tipos com TypeScript.
- `npm run build` compila o app para produção.

No teste em três celulares, registre uma despesa de R$ 50 paga por A. Divida um item de R$ 30 entre A e B e outro de R$ 20 entre B e C. Confira os saldos de A (+R$ 35), B (−R$ 25) e C (−R$ 10). Em seguida, lance uma despesa de outro celular, confirme a atualização automática, teste a foto e verifique o bloqueio de acesso depois de sair do grupo.

Edição e exclusão de despesas, acertos, troca de proprietário e login permanente ficam para uma próxima etapa.

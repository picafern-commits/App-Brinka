App Pai 5.0.0 - Firebase Sync a sério

Esta versão liga dispositivos entre si por Cloud Firestore.

Mantém:
- login interno da app
- visual premium
- faturas PDF
- histórico do cliente
- permissões

Firebase necessário:
1. Authentication > Sign-in method > Anonymous = ATIVO
2. Firestore Database criado
3. Regras Firestore publicadas

Regras recomendadas para esta versão:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

Coleções usadas:
- trabalhos
- clientes
- pagamentos

Como funciona:
- a app faz sign-in anónimo no Firebase
- depois sincroniza em tempo real entre dispositivos
- continua a guardar backup local invisível

Se o Firebase falhar, a app continua a abrir em modo local.


Ajustes clean Jorge Torneiro:
- removido conteúdo extra do login
- Gestão Empresa alterado para Jorge Torneiro
- backup JSON movido para Configurações
- logos GE substituídos pelo logo da empresa
- layout mais clean


Correção 5.1.1:
- revertido para base estável com login funcional
- removidas alterações que estavam a bloquear o botão Entrar


Correção inputs 5.1.2:
- removido código que estava a interferir com escrita nos campos
- mantida a base estável com login funcional
- versão segura para voltar a trabalhar sem bloqueios


Login automático 5.5.0:
- login separado em js/login.js
- sessão guardada no browser
- auto-login ao abrir a app
- logout limpa a sessão


Reorganização 5.6.0 (sem mexer no login):
- página nova Adicionar Trabalho
- Trabalhos fica só histórico
- Pagamentos fica só registo dos pagamentos
- Relatórios por cliente e mês
- clientes criados ficam disponíveis ao adicionar trabalho


Correção layout + login 1.0.6:
- páginas voltam a ficar ao lado da sidebar
- credenciais atualizadas para Jorge / jfernandes e Fátima / ffernandes
- login separado mantido


Correções 1.0.6:
- removidos listeners para elementos inexistentes que paravam o JS
- botões do histórico passam a funcionar
- botão Pago adicionado e funcional
- guardar cliente já não deve mandar para o login


Correções finais 1.0.6:
- app.js sem login duplicado
- removido código de pagamentos inexistente que partia botões
- botão Pago funcional
- guardar cliente estabilizado


Fix 1.0.6:
- botão Pago no histórico
- ao marcar Pago cria registo em Pagamentos
- histórico mostra coluna Faturação


Fix 1.0.6:
- markAsPaid passado para window.markAsPaid para o botão inline funcionar dentro de app.js module


Melhorias premium 1.0.6:
- badges visuais de estado e faturação
- escolha de método ao marcar como pago
- dashboard com métricas melhores
- ações por permissões (empresa)


Firebase religado 1.0.6:
- reforçada a inicialização do Firebase sem mexer no login.js
- startApp volta a tentar ligar ao Firebase após login/auto-login
- listeners em tempo real reiniciados ao autenticar
- se continuar em modo local, ativa Anonymous Auth no Firebase


Firebase fix 1.0.6:
- corrigido erro de sintaxe no prompt do método de pagamento que bloqueava o app.js e o Firebase.


Remoção de registos 1.0.6:
- apagar registos em Pagamentos
- apagar registos no Histórico Trabalhos
- remoção local + tentativa de sync remoto


Melhorias 1.0.6:
- botão Descrição no histórico quando existe descrição
- contacto do cliente preenchido automaticamente ao escolher cliente
- escolha de método de pagamento em modal mais bonito


Sistema de utilizadores 1.0.6:
- criar utilizadores dentro da app
- editar/apagar utilizadores na configuração
- login usa localStorage app_users com fallback para defaults
- gestão disponível para master admin


Fix Ricardo master 1.0.6:
- força o utilizador ricardo a master_admin mesmo que o app_users antigo diga user
- atualiza automaticamente o localStorage app_users


Adaptação mobile 1.0.6:
- Android e iPhone com layout otimizado
- sidebar escondida em mobile
- navegação inferior com todas as páginas
- formulários e tabelas ajustados ao ecrã

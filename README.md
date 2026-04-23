# Brinka Firebase Multi-dispositivo

Versão C: Firebase + multi-dispositivo.

## O que esta versão faz
- Guarda fechos no Firebase
- Sincroniza em tempo real entre PC e iPhone
- Também mantém cópia local
- Se Firebase falhar, não fica tudo partido
- Histórico, relatórios e export CSV

## Ativar Firebase
1. Abre `firebase-config.js`
2. Mete a config real do Firebase
3. Muda:
`window.BRINKA_FIREBASE_ENABLED = true;`

## Firestore
Cria a base Firestore em modo test.

Regras temporárias:
ver ficheiro `firestore-rules.txt`

## Publicar no GitHub Pages
Mete todos os ficheiros na raiz do repositório.
Depois Settings > Pages > Deploy from branch > main > /root.

Depois de atualizar:
CTRL + F5 no PC.
No iPhone fecha e abre o Safari ou limpa o separador.

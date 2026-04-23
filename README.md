# Brinka Firebase + Backups Diários v2

Alterações:
- Removidos os zeros visíveis nos campos das notas e moedas.
- Inputs começam vazios.
- Firebase preparado para multi-dispositivo.
- Backup diário automático para a coleção `brinka_backups_diarios`.
- Se Firebase não estiver configurado, a app continua em modo local sem rebentar.

## Para ligar Firebase
Edita `firebase-config.js` e troca todos os `COLOCA_AQUI`.

## Coleções usadas
- `brinka_fechos`
- `brinka_backups_diarios`

## Regras temporárias
Usa o ficheiro `firestore-rules.txt`.

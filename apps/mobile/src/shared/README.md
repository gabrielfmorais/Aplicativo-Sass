# shared/

Módulos do app que **não são tela e não são regra de domínio**: o que a casca precisa e o que mais de
uma feature usa. Sem regra de negócio — essa mora em `packages/core` (ADR-001).

Hoje: tradução de falha para texto (`failure-detail`), o caminho da pilha de telas
(`stacked-path`, SPEC-061) e as regras de revalidação do board (`board-refresh`, SPEC-070).

⚠️ **Por que os dois últimos não moram em `src/app/`:** aquele diretório é o do `expo-router`, e todo
arquivo dentro dele é tratado como **rota**. Um módulo comum ali faz o app avisar, em toda carga,
que a "rota" não tem `default export` — ruído de console num projeto cujo critério de pronto inclui
console limpo (D-90).

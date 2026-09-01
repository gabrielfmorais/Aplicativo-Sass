import { z } from 'zod';

/**
 * SPEC-018 §11 — como ela quer ser chamada.
 *
 * O limite espelha a constraint da tabela (`profiles_display_name_length`), de propósito: a
 * interface recusa antes de pedir ao servidor, e o banco recusa de novo se um cliente adulterado
 * ignorar a interface. Duas barreiras para a mesma regra é o desenho, não duplicação acidental.
 */
export const DISPLAY_NAME_MAX_LENGTH = 60;

/**
 * Espaço interno colapsa: `"Ana   Maria"` cumprimenta como `"Ana Maria"`. Sem isso, o produto
 * devolve à usuária um erro de digitação dela como se fosse a escolha dela — e a tela que mais
 * precisa acertar o nome é justamente a que o repete de volta.
 *
 * Só espaço em branco vira string vazia e é recusado aqui, antes de virar uma linha que parece
 * preenchida e cumprimenta o vazio.
 */
export const DisplayNameSchema = z
  .string()
  .transform((raw) => raw.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH));

export type DisplayName = z.infer<typeof DisplayNameSchema>;

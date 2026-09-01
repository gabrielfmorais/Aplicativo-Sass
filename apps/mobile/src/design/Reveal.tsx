import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from './motion';
import { REVEAL_MS, REVEAL_RISE } from './tokens';

/**
 * SPEC-018 fatia 3 — a transição entre uma tela e a próxima.
 *
 * **O problema que resolve.** O onboarding troca a pergunta no lugar: o texto some e outro aparece
 * no mesmo pixel, sem nada dizendo que houve um passo. Isso faz oito perguntas parecerem um
 * formulário que não anda. Um fade curto com uma subida de poucos pontos diz "avançou" — que é a
 * informação que faltava, não decoração.
 *
 * **Como se usa.** Com `key`: quem monta decide o que conta como "novo conteúdo", e o React remonta,
 * o que reinicia a animação. Sem `key`, isto anima uma vez e nunca mais.
 *
 * Redução de movimento ligada ⇒ **nenhuma animação**, conteúdo já em posição (FR4). Não é uma
 * versão mais lenta: é a ausência dela.
 */
export function Reveal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  /**
   * Começa **visível**, não em zero. Se a leitura da preferência falhar, isto nunca sai de onde
   * começou — e o conteúdo precisa estar lá de qualquer jeito. Um passo do onboarding invisível
   * porque uma consulta de acessibilidade não respondeu seria trocar um defeito pequeno por um
   * enorme.
   */
  const t = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Ainda não sabemos: não animar. Antes isto animava no otimismo e a resposta chegava tarde
    // demais — quem pedia menos movimento via a transição em toda troca de passo.
    if (reduce === null) return;
    if (reduce) {
      t.setValue(1);
      return;
    }
    t.setValue(0);
    const animation = Animated.timing(t, {
      toValue: 1,
      duration: REVEAL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduce, t]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [REVEAL_RISE, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

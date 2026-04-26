import confetti from 'canvas-confetti';
import { useCallback } from 'react';

export function useConfetti() {
  const disparar = useCallback((tipo: 'simples' | 'celebracao' | 'conquista' = 'celebracao') => {
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    switch (tipo) {
      case 'simples':
        confetti({
          ...defaults,
          particleCount: 50,
          spread: 60,
          startVelocity: 30,
        });
        break;

      case 'conquista':
        // Confetti mais elaborado para conquistas importantes
        const count = 200;
        const defaultsConquista = {
          origin: { y: 0.7 },
          zIndex: 9999,
        };

        function fire(particleRatio: number, opts: confetti.Options) {
          confetti({
            ...defaultsConquista,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
          });
        }

        fire(0.25, {
          spread: 26,
          startVelocity: 55,
        });
        fire(0.2, {
          spread: 60,
        });
        fire(0.35, {
          spread: 100,
          decay: 0.91,
          scalar: 0.8,
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 25,
          decay: 0.92,
          scalar: 1.2,
        });
        fire(0.1, {
          spread: 120,
          startVelocity: 45,
        });
        break;

      case 'celebracao':
      default:
        // Efeito padrão de celebração
        confetti({
          ...defaults,
          particleCount: 100,
          spread: 70,
          startVelocity: 40,
          colors: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
        });

        // Segunda onda após pequeno delay
        setTimeout(() => {
          confetti({
            ...defaults,
            particleCount: 50,
            spread: 90,
            origin: { y: 0.6 },
          });
        }, 150);
        break;
    }
  }, []);

  const dispararLados = useCallback(() => {
    const end = Date.now() + 1000;

    const colors = ['#10b981', '#3b82f6', '#f59e0b'];

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
        zIndex: 9999,
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
        zIndex: 9999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return { disparar, dispararLados };
}

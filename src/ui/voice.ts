/**
 * Voix de l'entraîneur : synthèse vocale du navigateur (rien n'est envoyé sur Internet par l'application).
 * Activée ou coupée dans les paramètres (`coachVoice`), désactivée par défaut.
 */

export const speechOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function frenchVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'fr-CA') ?? voices.find((v) => v.lang === 'fr-FR') ?? voices.find((v) => v.lang.toLowerCase().startsWith('fr'));
}

const PIECES: Record<string, string> = { R: 'roi', D: 'dame', T: 'tour', F: 'fou', C: 'cavalier', K: 'roi', Q: 'dame', B: 'fou', N: 'cavalier' };
const PROMO: Record<string, string> = { D: 'dame', T: 'tour', F: 'fou', C: 'cavalier', Q: 'dame', R: 'tour', B: 'fou', N: 'cavalier' };

/**
 * Texte lisible à voix haute : retire la mise en forme (**gras**) et lit la notation des coups
 * (« Td1+ » → « tour d1, échec » ; « e8=D » → « e8, promotion en dame » ; « O-O » → « petit roque »).
 */
export function speakable(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\bO-O-O\b/g, 'grand roque')
    .replace(/\bO-O\b/g, 'petit roque')
    .replace(/\b([RDTFCKQBN])?([a-h])?x?([a-h][1-8])(?:=([DTFCQRBN]))?([+#])?(?=[\s.,;:!?)»]|$)/g, (m, piece: string | undefined, from: string | undefined, to: string, promo: string | undefined, sign: string | undefined) => {
      // Une case seule (« e4 ») reste telle quelle ; on ne touche qu'aux coups notés.
      if (!piece && !from && !promo && !sign && !m.includes('x')) return m;
      const parts = [piece ? `${PIECES[piece]} ${m.includes('x') ? 'prend en ' : ''}${to}` : m.includes('x') ? `${from ?? ''} prend en ${to}` : to];
      if (promo) parts.push(`promotion en ${PROMO[promo]}`);
      if (sign === '+') parts.push('échec');
      if (sign === '#') parts.push('échec et mat');
      return parts.join(', ');
    });
}

export function stopSpeaking() {
  if (speechOk()) window.speechSynthesis.cancel();
}

/** Lit un texte (interrompt la phrase en cours). */
export function speak(text: string, handlers: { onend?: () => void; onerror?: () => void } = {}) {
  if (!speechOk()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = 'fr-FR';
  const v = frenchVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  }
  u.rate = 0.95;
  if (handlers.onend) u.onend = handlers.onend;
  if (handlers.onerror) u.onerror = handlers.onerror;
  window.speechSynthesis.speak(u);
}

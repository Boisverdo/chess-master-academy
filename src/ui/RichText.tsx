import { Fragment } from 'react';

/** Affiche un texte avec paragraphes, listes numérotées et **gras**, sans jamais interpréter de HTML. */
export function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
    );

  return (
    <div className="rich-text">
      {text.split(/\n\n+/).map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\d+\.\s/, ''))}</li>
              ))}
            </ol>
          );
        }
        if (lines.length > 1 && lines.slice(1).every((l) => /^\d+\.\s/.test(l))) {
          return (
            <Fragment key={i}>
              <p>{inline(lines[0]!)}</p>
              <ol>
                {lines.slice(1).map((l, j) => (
                  <li key={j}>{inline(l.replace(/^\d+\.\s/, ''))}</li>
                ))}
              </ol>
            </Fragment>
          );
        }
        return <p key={i}>{lines.map((l, j) => (j ? [<br key={j} />, ...inline(l)] : inline(l)))}</p>;
      })}
    </div>
  );
}

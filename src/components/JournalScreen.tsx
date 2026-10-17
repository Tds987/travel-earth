export function JournalScreen() {
  return (
    <section className="journal" aria-labelledby="journal-title">
      <div className="journal__seal" aria-hidden="true">
        旅
      </div>
      <h1 id="journal-title" className="journal__title">
        Your journal
      </h1>
      <p className="journal__text">
        Like a temple seal book: each place you visit gets a red stamp here, with your notes and
        photos. Private, and kept on this phone.
      </p>
      <p className="journal__soon">Coming next.</p>
    </section>
  )
}

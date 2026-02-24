export const Footer = () => {
  return (
    <footer className="flex flex-col items-center gap-2" style={{ gridArea: "footer" }}>
      <div className="text-md opacity-80">
        {/* <a href="https: //haukeschnau.de" target="_blank" rel="noreferrer"> */}
        Eine Hauke Schnau Produktion
        {/* </a> */}
      </div>

      <div className="flex gap-4 text-sm opacity-60">
        <a href="/impressum">Impressum</a>
        <a href="/datenschutz">Datenschutz</a>
      </div>
    </footer>
  );
};

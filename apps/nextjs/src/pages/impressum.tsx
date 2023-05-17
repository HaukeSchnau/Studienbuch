const ImpressumPage = () => {
  return <></>;
};

export function getServerSideProps() {
  return {
    redirect: {
      destination: "https://haukeschnau.de/impressum",
    },
  };
}

export default ImpressumPage;

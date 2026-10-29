// Metro's Babel transformer, with text files as modules that export their contents: drizzle-kit's
// `migrations.js` imports each device migration's SQL, and the conformance replay its fixture
// (`@stu/sync/conformance`). The Vite plugin in packages/sync does the same for the tests.
const upstream = require(
  require.resolve("@expo/metro-config/build/babel-transformer", {
    paths: [require.resolve("expo/package.json")],
  }),
);

const text = /\.(?:sql|jsonl)$/u;

module.exports = {
  ...upstream,
  transform: (props) =>
    upstream.transform(
      text.test(props.filename)
        ? { ...props, src: `module.exports = ${JSON.stringify(props.src)};` }
        : props,
    ),
};

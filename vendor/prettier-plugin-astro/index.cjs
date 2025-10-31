const languages = [
  {
    name: 'Astro',
    parsers: ['astro-raw'],
    extensions: ['.astro'],
    vscodeLanguageIds: ['astro'],
  },
];

const parsers = {
  'astro-raw': {
    parse(text) {
      return {
        type: 'AstroDocument',
        text,
      };
    },
    astFormat: 'astro-raw',
    locStart() {
      return 0;
    },
    locEnd(node) {
      return typeof node.text === 'string' ? node.text.length : 0;
    },
  },
};

const printers = {
  'astro-raw': {
    print(path) {
      const value = path.getValue();
      return typeof value.text === 'string' ? value.text : '';
    },
  },
};

module.exports = {
  languages,
  parsers,
  printers,
};

/* global require, module */
const CopyPlugin = require('copy-webpack-plugin');

const { wordim } = require('./wordim');
const { plainFlashCards } = require('./plainFlashCards');
const { toCSV } = require('./toCSV');
const { toTXT } = require('./toTXT');
const { toPDF } = require('./toPDF');
const { IndexPagePlugin } = require('./indexPage');

const units = [
  'more1-unit01',
  'more1-unit02',
  'more1-unit03',
  'more1-unit04',
  'more1-unit05',
  'more1-unit06',
  'more1-unit07',
  'more1-unit08',
  'more1-unit09',
  'more1-unit10',
];

const versions = [
  {
    name: 'wordim',
    label: 'Wordim (iOS)',
    extension: 'wordim',
    transform: (content, file) => wordim(content),
  },
  {
    name: 'csv-file-example',
    label: 'Amazing Flash Cards (iOS)',
    extension: 'csv',
    transform: (content, file) => toCSV(content, true),
  },
  {
    name: 'plain-flashcards',
    label: 'Plain Flashcards (iOS)',
    extension: 'zip',
    transform: (content, file) => plainFlashCards(content, file),
  },
  {
    name: 'csv-file',
    label: 'Simple Anki (iOS)',
    extension: 'csv',
    transform: (content, file) => toCSV(content),
  },
  {
    name: 'text-file',
    label: 'Smart Repetition (iOS, Android)',
    extension: 'txt',
    transform: (content, file) => toTXT(content),
  },
  {
    name: 'pdf-worksheet',
    label: 'Worksheet (PDF)',
    extension: 'pdf',
    transform: (content, file) => toPDF(content),
  },
  {
    name: 'pdf-solutions',
    label: 'Solutions (PDF)',
    extension: 'pdf',
    transform: (content, file) => toPDF(content, true),
  },
];

const patterns = [];
units.forEach((file) => {
  versions.forEach((version) => {
    patterns.push({
      from: './src/' + file + '.json',
      to: './' + version.name + '/' + file + '.' + version.extension,
      transform: (content) => version.transform(content, file)
    });
  });
});

module.exports = {
  entry: './src/index.js',
  mode: 'production',
  output: {
    clean: true,
  },
  plugins: [
    new CopyPlugin({ patterns }),
    new IndexPagePlugin({ units, versions }),
  ],
};

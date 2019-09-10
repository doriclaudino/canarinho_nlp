const natural = require("natural");
const fs = require("fs");
const sw = require("stopword");
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();
const program = require("commander");
const pjson = require("../package.json");
const latinMap = require("./latinMap");

program
  .version(pjson.version)
  .command("import <dir>")
  .option("-s, --suffix <sufix>", "suffix to save")
  .option("--tfidf", "show tfidf frequency analysis")
  .option("--no-accent", "remove accent")
  .option("--no-emoji", "remove emoji")
  .action(function(dir, options) {
    main(dir, options);
  });
program.parse(process.argv);

function main(path, options) {
  const {
    tfidf = false,
    suffix = "clean.json",
    removeAccent: accent = false,
    removeEmoji: emoji = false
  } = options;
  const saveFileName = path + suffix;

  let doc = readFile(path);
  let lines = breakInLines(doc);
  let cleanedSentences = cleanData(lines, removeAccent, removeEmoji);
  saveToDisk(cleanedSentences, saveFileName);

  if (tfidf) {
    wordFrequency(cleanedSentences);
    printWordFrequency();
  }
}

function readFile(path) {
  return fs.readFileSync(path, "utf8");
}

function breakInLines(document) {
  tokenizer = new natural.RegexpTokenizer({
    pattern: /^\d{1,2}\/\d{1,2}\/\d{1,2}\,\s/gim
  });
  return tokenizer.tokenize(document);
}

function cleanData(sentences = [], removeAccent, removeEmoji) {
  if (!sentences.length) return sentences;

  const skipThoseMessages = [
    "This message was deleted",
    "<Media omitted>",
    "Waiting for this message",
    ".vcf (file attached)"
  ];

  const filteredTokens = [];
  for (let index = 0; index < sentences.length; index++) {
    const line = sentences[index];
    const containsTwoDots = new RegExp(/\:.*\:/, "gmi").test(line);

    //two dots means we find some
    if (!containsTwoDots) continue;

    foundAndSkip = skipThoseMessages.some(message => {
      return line.toLocaleLowerCase().indexOf(message.toLocaleLowerCase()) > -1;
    });
    if (foundAndSkip) continue;

    removeHeadDateAndUserPhone = line
      .toLocaleLowerCase()
      .replace(/.{1,10}\:\d{1,2}\s.{1,50}\:\s/gim, "");
    removeNewLine = removeHeadDateAndUserPhone
      .toLocaleLowerCase()
      .replace(/\n$/, "");
    removeNewLine = removeNewLine.toLocaleLowerCase().replace(/^\n/, "");

    //remove dups/spamm
    if (filteredTokens.find(e => e === removeNewLine)) continue;

    //remove double space
    removeNewLine = removeNewLine.replace('  ', ' ');    

    if (removeAccent) removeNewLine = removeAccent(removeNewLine);
    if (removeEmoji) removeNewLine = removeEmoji(removeNewLine);

    //replace enter
    removeNewLine = removeNewLine.replace('\n', '⏎');

    filteredTokens.push(removeNewLine);
  }
  return filteredTokens;
}

function removeEmoji(str) {
  const emoji = /([#0-9]\u20E3)|[\xA9\xAE\u203C\u2047-\u2049\u2122\u2139\u3030\u303D\u3297\u3299][\uFE00-\uFEFF]?|[\u2190-\u21FF][\uFE00-\uFEFF]?|[\u2300-\u23FF][\uFE00-\uFEFF]?|[\u2460-\u24FF][\uFE00-\uFEFF]?|[\u25A0-\u25FF][\uFE00-\uFEFF]?|[\u2600-\u27BF][\uFE00-\uFEFF]?|[\u2900-\u297F][\uFE00-\uFEFF]?|[\u2B00-\u2BF0][\uFE00-\uFEFF]?|(?:\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDEFF])[\uFE00-\uFEFF]?|[\u20E3]|[\u26A0-\u3000]|\uD83E[\udd00-\uddff]|[\u00A0-\u269F]/g;
  return str.replace(emoji, "");
}

function removeAccent(str) {
  return str.replace(/[^A-Za-z0-9]/g, letter => {
    return latinMap[letter] || letter;
  });
}

function saveToDisk(data, path) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function wordFrequency(sentences) {
  sentences.forEach(sentence => {
    /**
     * remove stop words like com,em,no,ou,de,etc
     */
    tempTokens = sentence.split(" ");
    tempTokens = sw.removeStopwords(tempTokens, sw.br);
    //tempTokens = sw.removeStopwords(tempTokens, ["etc", "no", "em", "ou"]);
    tfidf.addDocument(tempTokens);
  });
}

function printWordFrequency() {
  tfidf.listTerms(0 /*document index*/).forEach(function(item) {
    console.log(item.term + ": " + item.tfidf);
  });
}

/**
 * todo
 *
 * use params instead always ask user
 * check tfidf cleaning rules
 * remove accents from portuguese or lemmatize
 *
 */

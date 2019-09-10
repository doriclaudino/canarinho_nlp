const natural = require("natural");
const fs = require("fs");
const sw = require("stopword");
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();
const program = require("commander");
const pjson = require("../package.json");

program
  .version(pjson.version)
  .command("import <dir>")
  .option("-f, --tfidf", "show tfidf frequency analysis")
  .option("-s, --suffix <sufix>", "suffix to save")
  .action(function(dir, options) {
    const { tfidf = false, suffix = "clean.json" } = options;
    const saveFileName = dir + suffix;
    main(dir, tfidf, saveFileName);
  });
program.parse(process.argv);

function main(path, tfidf, saveFileName) {
  let doc = readFile(path);
  let lines = breakInLines(doc);
  let cleanedSentences = cleanData(lines);
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

function cleanData(sentences = []) {
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

    filteredTokens.push(removeNewLine);
  }
  return filteredTokens;
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

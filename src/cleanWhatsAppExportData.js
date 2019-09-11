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
  .option("-s, --suffix <suffix>", "suffix to save", ".clean.json")
  .option("--tfidf", "show tfidf frequency analysis", false)
  .option("--accent", "allow accents", false)
  .option("--emoji", "allow emojis", false)
  .option("--no-lowercase", "transform to lower or maintain the case-sensitive", true)
  .option("--doublespaces", "allow doublespaces", false)
  .option("--duplicates", "allow duplicates texts", false)
  .option("--empty", "allow empty texts", false)
  .action(function (dir, options) {
    crossPath = dir.replace('\\', '/')
    main(crossPath, options);
  });
program.parse(process.argv);

function main(path, options) {
  const {
    tfidf = false,
      suffix,
      accent,
      emoji,
      lowercase,
      doublespaces,
      duplicates,
      empty
  } = options;
  const saveFileName = path + suffix;

  let doc = readFile(path);
  let lines = breakInLines(doc);
  let cleanedSentences = cleanData(lines, accent, emoji, lowercase, doublespaces, duplicates, empty);
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

function cleanData(sentences = [], allowAccent, allowEmoji, lowerCase, allowDoubleSpaces, allowDuplicates, allowEmpty) {
  console.log(`
  allowAccent: ${allowAccent}, 
  allowEmoji: ${allowEmoji}, 
  lowerCase: ${lowerCase}, 
  allowDoubleSpaces: ${allowDoubleSpaces},
  allowDuplicates: ${allowDuplicates},
  allowEmpty: ${allowEmpty}
  `)
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

    let copyLine = line
    if (lowerCase == true)
      copyLine = line.toLocaleLowerCase()

    copyLine = removeLineDataHeader(copyLine);
    copyLine = removeEndLineBreakLine(copyLine);
    copyLine = removeInitialBreakLine(copyLine);

    //remove dups/spamm
    if (!allowDuplicates && filteredTokens.find(e => e === copyLine)) continue;

    if (!allowAccent) copyLine = removeAccent(copyLine);
    if (!allowEmoji) copyLine = removeEmoji(copyLine);

    //replace enter
    copyLine = copyLine.replace(/\n/gmi, '⏎');

    //remove double space
    if (!allowDoubleSpaces)
      copyLine = removeDoubleSpaces(copyLine)

    copyLine = copyLine.split(/\W+/gmi).join(',')
    copyLine = copyLine.replace(/\,/gmi, ' ')
    copyLine = removePhoneNumber(copyLine)
    copyLine = copyLine.replace(/^\s/gmi, '')
    copyLine = copyLine.replace(/\s$/gmi, '')    

    //ignore empty strings
    if (!allowEmpty && isEmpty(copyLine)) continue;
    filteredTokens.push(copyLine);
  }
  return filteredTokens;
}

//https://regex101.com/r/dUAl4h/2
function removePhoneNumber(str) {
  return str.replace(/(\d{9,12}|(\d\s)?\d{3,4}\s\d{3}\s\d{4})/gmi, '')
}

function isEmpty(str) {
  return str.trim().length === 0
}

function removeLineDataHeader(str) {
  return str.replace(/.{1,10}\:\d{1,2}\s.{1,50}\:\s/gim, "");
}

function removeInitialBreakLine(str) {
  return str.replace(/^\n/gmi, "");
}

function removeEndLineBreakLine(str) {
  return str.replace(/\n$/gmi, "");
}

function removeDoubleSpaces(str) {
  const regex = /\s{2,}/gmi;
  return str.replace(regex, '')
}

function removeEmoji(str) {
  const emoji = /([#0-9]\u20E3)|[\xA9\xAE\u203C\u2047-\u2049\u2122\u2139\u3030\u303D\u3297\u3299][\uFE00-\uFEFF]?|[\u2190-\u21FF][\uFE00-\uFEFF]?|[\u2300-\u23FF][\uFE00-\uFEFF]?|[\u2460-\u24FF][\uFE00-\uFEFF]?|[\u25A0-\u25FF][\uFE00-\uFEFF]?|[\u2600-\u27BF][\uFE00-\uFEFF]?|[\u2900-\u297F][\uFE00-\uFEFF]?|[\u2B00-\u2BF0][\uFE00-\uFEFF]?|(?:\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDEFF])[\uFE00-\uFEFF]?|[\u20E3]|[\u26A0-\u3000]|\uD83E[\udd00-\uddff]|[\u00A0-\u269F]/gmi;
  return str.replace(emoji, "");
}

function removeAccent(str) {
  return str.replace(/[^A-Za-z0-9]/gmi, letter => {
    return latinMap[letter] || letter;
  });
}

function saveToDisk(data, path) {
  fs.writeFileSync(path, JSON.stringify(data, null, 1));
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
  tfidf.listTerms(0 /*document index*/ ).forEach(function (item) {
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
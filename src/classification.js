/**
 * https://github.com/NaturalNode/natural/tree/a79254585f2e381378f788de5168f6a906e037e8#classifiers
 */


var natural = require('natural'),
  classifier = new natural.BayesClassifier();

classifier.addDocument('i am long qqqq', 'buy');
classifier.addDocument('buy the q\'s', 'buy');
classifier.addDocument('short gold', 'sell');
classifier.addDocument('sell gold', 'sell');
classifier.addDocument(['sell', 'gold'], 'sell');

classifier.train();


/**
 * the idea here is test something never trained before, like the "silver" metal
 * short and sell means samething on stockmarket as well the buy and long
 */
// must show sell because we teach short means sell
console.log(classifier.classify('i am short silver'));

//here stats behind
console.log(classifier.getClassifications('i am long copper'));